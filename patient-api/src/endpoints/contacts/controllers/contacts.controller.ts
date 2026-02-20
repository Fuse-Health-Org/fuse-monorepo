import { Request, Response } from 'express';
import User from '../../../models/User';
import { getCurrentUser } from '../../../config/jwt';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { getLastContactDate, getUserEngagementStats } from '../services/contacts.service';
import { MailsSender } from '../../../services/mailsSender';
import Clinic from '../../../models/Clinic';
import UserTag from '../../../models/UserTag';
import Tag from '../../../models/Tag';
import { AuditService } from '../../../services/audit.service';
import { AuditAction, AuditResourceType } from '../../../models/AuditLog';

/**
 * GET /contacts
 * List all contacts (patients) for the current clinic
 */
export const listContacts = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    if (!currentUser.clinicId) {
      return res.status(400).json({
        success: false,
        message: "User does not belong to a clinic"
      });
    }

    // Query parameters for filtering
    const { 
      search, 
      optOutStatus, // 'all', 'active', 'email_opted_out', 'sms_opted_out'
      tagId, // Filter by specific tag
      limit = '50', 
      offset = '0',
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    // Build where clause
    const whereClause: any = {
      clinicId: currentUser.clinicId,
      role: 'patient' // Only show patients, not doctors/admins
    };

    // Search by name or email
    if (search && typeof search === 'string' && search.trim()) {
      whereClause[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    // Filter by opt-out status
    if (optOutStatus && optOutStatus !== 'all') {
      switch (optOutStatus) {
        case 'email_opted_out':
          whereClause.emailOptedOut = true;
          break;
        case 'sms_opted_out':
          whereClause.smsOptedOut = true;
          break;
        case 'active':
          whereClause.emailOptedOut = false;
          whereClause.smsOptedOut = false;
          break;
      }
    }

    const parsedLimit = parseInt(limit as string, 10);
    const parsedOffset = parseInt(offset as string, 10);

    // Valid sort fields
    const validSortFields = ['createdAt', 'firstName', 'lastName', 'email'];
    const sortField = validSortFields.includes(sortBy as string) ? sortBy as string : 'createdAt';

    // Build query with optional tag filter
    const queryOptions: any = {
      where: whereClause,
      attributes: [
        'id',
        'firstName',
        'lastName',
        'email',
        'phoneNumber',
        'emailOptedOut',
        'smsOptedOut',
        'optOutDate',
        'createdAt',
        'lastLoginAt'
      ],
      include: [
        {
          model: UserTag,
          as: 'userTags',
          required: false, // LEFT JOIN to include users without tags
          attributes: ['id', 'tagId', 'assignedAt'],
          include: [
            {
              model: Tag,
              as: 'tag',
              attributes: ['id', 'name', 'color', 'category']
            }
          ]
        }
      ],
      order: [[sortField, sortOrder as string]],
      limit: Number.isFinite(parsedLimit) ? parsedLimit : 50,
      offset: Number.isFinite(parsedOffset) ? parsedOffset : 0,
      distinct: true // For correct count with includes
    };

    // Filter by tag if provided
    if (tagId && typeof tagId === 'string') {
      queryOptions.include[0].required = true; // INNER JOIN for tag filter
      queryOptions.include[0].where = { tagId };
    }

    const { count, rows: contacts } = await User.findAndCountAll(queryOptions);

    // Enrich contacts with last contact date and tags
    const enrichedContacts = await Promise.all(
      contacts.map(async (contact) => {
        const lastContactDate = await getLastContactDate(contact.id);
        const contactJSON = contact.toJSON() as any;

        // Extract tags from userTags
        const tags = contactJSON.userTags?.map((ut: any) => ut.tag).filter((tag: any) => tag) || [];

        return {
          ...contactJSON,
          lastContactDate,
          tags // Clean tags array
        };
      })
    );

    // Audit log: Bulk patient list access (PHI)
    await AuditService.logFromRequest(req, {
      action: AuditAction.VIEW,
      resourceType: AuditResourceType.PATIENT,
      details: {
        operation: 'bulk_list',
        count,
        filters: {
          search: search || null,
          optOutStatus: optOutStatus || null,
          tagId: tagId || null
        }
      }
    });

    res.status(200).json({
      success: true,
      data: {
        contacts: enrichedContacts,
        total: count,
        limit: parsedLimit,
        offset: parsedOffset
      }
    });

  } catch (error) {
    console.error('❌ Error fetching contacts:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contacts"
    });
  }
};

/**
 * GET /contacts/:id
 * Get a single contact with detailed information
 */
export const getContact = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const { id } = req.params;

    const contact = await User.findOne({
      where: {
        id,
        clinicId: currentUser.clinicId,
        role: 'patient'
      },
      attributes: [
        'id',
        'firstName',
        'lastName',
        'email',
        'phoneNumber',
        'emailOptedOut',
        'smsOptedOut',
        'optOutDate',
        'createdAt',
        'lastLoginAt',
        'dob',
        'address',
        'city',
        'state',
        'zipCode'
      ]
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found"
      });
    }

    // Audit log: Individual patient view (PHI access)
    await AuditService.logPatientView(req, contact.id, {
      operation: 'view_contact_details'
    });

    // Get engagement stats
    const engagementStats = await getUserEngagementStats(contact.id);
    const lastContactDate = await getLastContactDate(contact.id);

    res.status(200).json({
      success: true,
      data: {
        ...contact.toJSON(),
        lastContactDate,
        engagement: engagementStats
      }
    });

  } catch (error) {
    console.error('❌ Error fetching contact:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contact"
    });
  }
};

/**
 * PUT /contacts/:id
 * Update a contact's information
 */
export const updateContact = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const { id } = req.params;
    const { firstName, lastName, email, phoneNumber } = req.body;

    // Verify contact exists and belongs to clinic
    const contact = await User.findOne({
      where: {
        id,
        clinicId: currentUser.clinicId,
        role: 'patient'
      }
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found"
      });
    }

    // Validate required fields
    if (!firstName || !firstName.trim()) {
      return res.status(400).json({
        success: false,
        message: "First name is required"
      });
    }

    if (!lastName || !lastName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Last name is required"
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // Check if email is already taken by another user
    if (email !== contact.email) {
      const existingUser = await User.findOne({
        where: {
          email: email.trim().toLowerCase(),
          clinicId: currentUser.clinicId
        }
      });

      if (existingUser && existingUser.id !== contact.id) {
        return res.status(400).json({
          success: false,
          message: "Email is already in use by another contact"
        });
      }
    }

    // Track changed fields for audit log
    const changedFields: string[] = [];
    if (contact.firstName !== firstName.trim()) changedFields.push('firstName');
    if (contact.lastName !== lastName.trim()) changedFields.push('lastName');
    if (contact.email !== email.trim().toLowerCase()) changedFields.push('email');
    if (phoneNumber !== undefined && contact.phoneNumber !== (phoneNumber?.trim() || null)) {
      changedFields.push('phoneNumber');
    }

    // Update contact
    contact.firstName = firstName.trim();
    contact.lastName = lastName.trim();
    contact.email = email.trim().toLowerCase();

    if (phoneNumber !== undefined) {
      contact.phoneNumber = phoneNumber?.trim() || null;
    }

    await contact.save();

    // Audit log: Patient record update (PHI modification)
    if (changedFields.length > 0) {
      await AuditService.logPatientUpdate(req, contact.id, changedFields);
    }

    res.status(200).json({
      success: true,
      data: {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phoneNumber: contact.phoneNumber
      },
      message: "Contact updated successfully"
    });

  } catch (error) {
    console.error('❌ Error updating contact:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update contact"
    });
  }
};

/**
 * GET /contacts/:id/history
 * Get sequence history for a contact
 */
export const getContactHistory = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const { id } = req.params;

    // Verify contact belongs to clinic
    const contact = await User.findOne({
      where: {
        id,
        clinicId: currentUser.clinicId,
        role: 'patient'
      }
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found"
      });
    }

    // Audit log: Patient history view (PHI access)
    await AuditService.logPatientView(req, contact.id, {
      operation: 'view_contact_history'
    });

    // Get all sequence runs for this contact
    // Note: This is a simplified version - in production you'd want a better way to link users to runs
    const { default: SequenceRun } = await import('../../../models/SequenceRun');
    const { default: Sequence } = await import('../../../models/Sequence');

    const runs = await SequenceRun.findAll({
      where: {
        clinicId: currentUser.clinicId,
        [Op.and]: Sequelize.literal(`payload::text LIKE '%${contact.email}%'`)
      },
      include: [
        {
          model: Sequence,
          as: 'sequence',
          attributes: ['id', 'name', 'status']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 100
    });

    res.status(200).json({
      success: true,
      data: {
        contactId: id,
        contactName: `${contact.firstName} ${contact.lastName}`,
        contactEmail: contact.email,
        history: runs
      }
    });

  } catch (error) {
    console.error('❌ Error fetching contact history:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contact history"
    });
  }
};

/**
 * POST /contacts
 * Create a new contact (patient)
 */
export const createContact = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    if (!currentUser.clinicId) {
      return res.status(400).json({
        success: false,
        message: "User does not belong to a clinic"
      });
    }

    const { firstName, lastName, email, phoneNumber } = req.body;

    // Validate required fields
    if (!firstName || !firstName.trim()) {
      return res.status(400).json({
        success: false,
        message: "First name is required"
      });
    }

    if (!lastName || !lastName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Last name is required"
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    // Check if email already exists in this clinic
    const existingUser = await User.findOne({
      where: {
        email: email.trim().toLowerCase(),
        clinicId: currentUser.clinicId
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "A contact with this email already exists"
      });
    }

    // Validate phone number format if provided (USA format: 10 digits)
    if (phoneNumber && phoneNumber.trim()) {
      const cleanPhone = phoneNumber.trim().replace(/[\s\-\(\)\.]/g, '');
      
      // Accept USA format:
      // - Local: 5551234567 (10 digits only)
      // - International: +15551234567 (backward compatibility)
      const phoneRegex = /^(\+1)?\d{10}$/;
      
      if (!phoneRegex.test(cleanPhone)) {
        return res.status(400).json({
          success: false,
          message: "Phone number must be exactly 10 digits (e.g., 5551234567)"
        });
      }
    }

    // Create new contact (hash password first)
    const randomPassword = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    const passwordHash = await User.hashPassword(randomPassword);
    
    const newContact = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phoneNumber: phoneNumber?.trim() || null,
      clinicId: currentUser.clinicId,
      role: 'patient',
      passwordHash, // Use hashed password
      emailOptedOut: false,
      smsOptedOut: false
    });

    console.log(`✅ Contact created: ${newContact.firstName} ${newContact.lastName} (${newContact.email})`);

    // Audit log: Patient record creation
    await AuditService.logFromRequest(req, {
      action: AuditAction.CREATE,
      resourceType: AuditResourceType.PATIENT,
      resourceId: newContact.id,
      details: {
        operation: 'create_contact'
      }
    });

    // Get clinic name for email
    let clinicName = 'Your Healthcare Provider';
    try {
      const clinic = await Clinic.findByPk(currentUser.clinicId);
      if (clinic) {
        clinicName = clinic.name || clinicName;
      }
    } catch (err) {
      console.warn('⚠️ Could not fetch clinic name:', err);
    }

    // Send welcome email with temporary password (don't block response)
    MailsSender.sendPatientWelcomeEmail(
      newContact.email,
      newContact.firstName,
      randomPassword,
      clinicName
    ).catch(err => {
      console.error('❌ Failed to send welcome email (non-blocking):', err);
    });

    res.status(201).json({
      success: true,
      data: {
        id: newContact.id,
        firstName: newContact.firstName,
        lastName: newContact.lastName,
        email: newContact.email,
        phoneNumber: newContact.phoneNumber
      },
      message: "Contact created successfully. Welcome email sent."
    });

  } catch (error) {
    console.error('❌ Error creating contact:', error);
    res.status(500).json({
      success: false,
      message: "Failed to create contact"
    });
  }
};

/**
 * POST /contacts/upload-csv
 * Upload CSV file to import multiple contacts
 */
export const uploadCSV = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    if (!currentUser.clinicId) {
      return res.status(400).json({
        success: false,
        message: "User does not belong to a clinic"
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No CSV file uploaded"
      });
    }

    // Parse CSV content (handle UTF-8 BOM if present)
    let csvContent = req.file.buffer.toString('utf-8');
    if (csvContent.charCodeAt(0) === 0xFEFF) {
      csvContent = csvContent.slice(1); // Remove BOM
    }

    // Helper function to parse CSV line (handles quoted fields)
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      
      return result.map(field => field.replace(/^"|"$/g, '')); // Remove surrounding quotes
    };

    const lines = csvContent
      .split(/\r?\n/) // Handle both \n and \r\n
      .map(line => line.trim())
      .filter(line => line.length > 0);

    console.log(`📄 CSV Processing: ${lines.length} lines found`);

    if (lines.length < 2) {
      return res.status(400).json({
        success: false,
        message: "CSV file must contain at least a header row and one data row"
      });
    }

    // Parse header
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
    console.log('📋 CSV Headers:', headers);

    const requiredHeaders = ['firstname', 'lastname', 'email'];
    
    const missingHeaders = requiredHeaders.filter(
      required => !headers.some(h => h === required)
    );

    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required columns: ${missingHeaders.join(', ')}`
      });
    }

    // Get column indices
    const firstNameIdx = headers.findIndex(h => h === 'firstname');
    const lastNameIdx = headers.findIndex(h => h === 'lastname');
    const emailIdx = headers.findIndex(h => h === 'email');
    const phoneIdx = headers.findIndex(h => h === 'phonenumber');

    // Parse data rows
    const contacts: any[] = [];
    const errors: string[] = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // Phone validation: USA format (10 digits, +1 prefix optional for backward compatibility)
    const phoneRegex = /^(\+1)?\d{10}$/;

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const rowNum = i + 1;

      const firstName = values[firstNameIdx]?.trim() || '';
      const lastName = values[lastNameIdx]?.trim() || '';
      const email = values[emailIdx]?.trim() || '';
      const phoneNumber = phoneIdx >= 0 ? (values[phoneIdx]?.trim() || '') : '';

      console.log(`Row ${rowNum}: firstName="${firstName}", lastName="${lastName}", email="${email}", phone="${phoneNumber}"`);

      // Validate row
      if (!firstName || !lastName || !email) {
        errors.push(`Row ${rowNum}: Missing required fields (firstName="${firstName}", lastName="${lastName}", email="${email}")`);
        continue;
      }

      if (!emailRegex.test(email)) {
        errors.push(`Row ${rowNum}: Invalid email format (${email})`);
        continue;
      }

      // Validate phone if provided
      if (phoneNumber) {
        const cleanPhone = phoneNumber.replace(/[\s\-\(\)\.]/g, '');
        if (!phoneRegex.test(cleanPhone)) {
          errors.push(`Row ${rowNum}: Invalid phone format - must be exactly 10 digits (${phoneNumber})`);
          continue;
        }
      }

      contacts.push({
        firstName,
        lastName,
        email: email.toLowerCase(),
        phoneNumber: phoneNumber || null
      });
    }

    console.log(`✅ Parsed ${contacts.length} valid contacts, ${errors.length} errors`);

    if (contacts.length === 0) {
      console.error('❌ CSV Import failed - no valid contacts');
      if (errors.length > 0) {
        console.error('Errors:', errors);
      }
      return res.status(400).json({
        success: false,
        message: "No valid contacts found in CSV",
        errors: errors.slice(0, 10) // Return first 10 errors only
      });
    }

    // Check for duplicate emails within the CSV
    const emailSet = new Set<string>();
    const duplicatesInCSV: string[] = [];

    contacts.forEach((contact, idx) => {
      if (emailSet.has(contact.email)) {
        duplicatesInCSV.push(`Row ${idx + 2}: Duplicate email (${contact.email})`);
      } else {
        emailSet.add(contact.email);
      }
    });

    if (duplicatesInCSV.length > 0) {
      errors.push(...duplicatesInCSV);
    }

    // Get existing emails in the clinic
    const existingUsers = await User.findAll({
      where: {
        clinicId: currentUser.clinicId,
        email: {
          [Op.in]: contacts.map(c => c.email)
        }
      },
      attributes: ['email']
    });

    const existingEmails = new Set(existingUsers.map(u => u.email));

    // Filter out existing contacts
    const newContacts = contacts.filter(contact => {
      if (existingEmails.has(contact.email)) {
        errors.push(`Email already exists: ${contact.email}`);
        return false;
      }
      return true;
    });

    // Bulk create new contacts (hash passwords first)
    let imported = 0;
    const passwordMap = new Map<string, string>(); // email -> plain password
    
    if (newContacts.length > 0) {
      // Hash passwords for all contacts and track plain passwords
      const contactsToCreate = await Promise.all(
        newContacts.map(async (contact) => {
          const randomPassword = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
          const passwordHash = await User.hashPassword(randomPassword);
          
          // Store plain password for email
          passwordMap.set(contact.email, randomPassword);
          
          return {
            ...contact,
            clinicId: currentUser.clinicId,
            role: 'patient',
            passwordHash, // Use hashed password, not plain password
            emailOptedOut: false,
            smsOptedOut: false
          };
        })
      );

      const createdContacts = await User.bulkCreate(contactsToCreate, {
        validate: true,
        individualHooks: false // No need for hooks since we already hashed
      });

      imported = createdContacts.length;

      // Audit log: Bulk patient creation
      if (imported > 0) {
        await AuditService.logFromRequest(req, {
          action: AuditAction.CREATE,
          resourceType: AuditResourceType.PATIENT,
          details: {
            operation: 'bulk_create_csv',
            importedCount: imported,
            totalRows: contacts.length,
            skippedRows: errors.length
          }
        });
      }

      // Get clinic name for emails
      let clinicName = 'Your Healthcare Provider';
      try {
        const clinic = await Clinic.findByPk(currentUser.clinicId);
        if (clinic) {
          clinicName = clinic.name || clinicName;
        }
      } catch (err) {
        console.warn('⚠️ Could not fetch clinic name:', err);
      }

      // Send welcome emails to all created contacts (asynchronously, don't block response)
      console.log(`📧 Sending ${imported} welcome emails...`);
      Promise.all(
        createdContacts.map(async (contact) => {
          const password = passwordMap.get(contact.email);
          if (!password) {
            console.error(`❌ No password found for ${contact.email}`);
            return;
          }
          
          try {
            await MailsSender.sendPatientWelcomeEmail(
              contact.email,
              contact.firstName,
              password,
              clinicName
            );
          } catch (err) {
            console.error(`❌ Failed to send welcome email to ${contact.email}:`, err);
          }
        })
      ).then(() => {
        console.log(`✅ All ${imported} welcome emails sent`);
      }).catch(err => {
        console.error('❌ Error sending welcome emails:', err);
      });
    }

    console.log(`✅ CSV Import: ${imported} contacts imported, ${errors.length} errors`);

    res.status(200).json({
      success: true,
      data: {
        imported,
        total: contacts.length,
        skipped: errors.length,
        errors: errors.length > 0 ? errors.slice(0, 20) : undefined // Return first 20 errors
      },
      message: `Successfully imported ${imported} contacts${errors.length > 0 ? ` (${errors.length} skipped)` : ''}. Welcome emails are being sent.`
    });

  } catch (error) {
    console.error('❌ Error uploading CSV:', error);
    res.status(500).json({
      success: false,
      message: "Failed to upload CSV"
    });
  }
};

