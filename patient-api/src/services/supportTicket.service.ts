import SupportTicket, { TicketStatus, TicketPriority, TicketCategory } from '../models/SupportTicket';
import User from '../models/User';
import Clinic from '../models/Clinic';
import { Op } from 'sequelize';

interface CreateTicketData {
  title: string;
  description: string;
  priority: TicketPriority;
  category: TicketCategory;
  authorId: string;
  clinicId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

interface UpdateTicketData {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assignedToId?: string;
  assignedTeam?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

interface AddMessageData {
  ticketId: string;
  role: 'user' | 'support' | 'system';
  message: string;
}

interface TicketFilters {
  status?: TicketStatus | 'all';
  priority?: TicketPriority | 'all';
  category?: TicketCategory;
  clinicId?: string;
  authorId?: string;
  assignedToId?: string;
  search?: string;
}

export default class SupportTicketService {
  /**
   * Create a new support ticket
   */
  async createTicket(data: CreateTicketData): Promise<SupportTicket> {
    const ticket = await SupportTicket.create({
      title: data.title,
      description: data.description,
      priority: data.priority,
      category: data.category,
      authorId: data.authorId,
      clinicId: data.clinicId,
      status: TicketStatus.NEW,
      tags: data.tags || [],
      metadata: data.metadata || {},
      messages: [],
      messageCount: 0,
    });

    // Reload with associations
    const ticketWithAssociations = await SupportTicket.findByPk(ticket.id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
        {
          model: User,
          as: 'lastUpdatedBy',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
        {
          model: Clinic,
          as: 'clinic',
          attributes: ['id', 'name'],
        },
      ],
    });

    return ticketWithAssociations!;
  }

  /**
   * Get ticket by ID
   */
  async getTicketById(ticketId: string, userId: string): Promise<SupportTicket> {
    const ticket = await SupportTicket.findByPk(ticketId, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'email', 'city', 'state', 'address', 'role'],
          include: [
            {
              model: Clinic,
              as: 'clinic',
              attributes: ['id', 'name'],
            },
          ],
        },
        {
          model: User,
          as: 'assignedTo',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
        {
          model: User,
          as: 'lastUpdatedBy',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
        {
          model: Clinic,
          as: 'clinic',
          attributes: ['id', 'name'],
        },
      ],
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    return ticket;
  }

  /**
   * List tickets with filters
   */
  async listTickets(
    filters: TicketFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<{ tickets: SupportTicket[]; total: number; page: number; totalPages: number }> {
    const whereClause: any = {};

    // Status filter
    if (filters.status && filters.status !== 'all') {
      whereClause.status = filters.status;
    }

    // Priority filter
    if (filters.priority && filters.priority !== 'all') {
      whereClause.priority = filters.priority;
    }

    // Category filter
    if (filters.category) {
      whereClause.category = filters.category;
    }

    // Clinic filter
    if (filters.clinicId) {
      whereClause.clinicId = filters.clinicId;
    }

    // Author filter
    if (filters.authorId) {
      whereClause.authorId = filters.authorId;
    }

    // Assigned to filter
    if (filters.assignedToId) {
      if (filters.assignedToId === 'null') {
        whereClause.assignedToId = { [Op.is]: null };
      } else {
        whereClause.assignedToId = filters.assignedToId;
      }
    }

    // Search filter
    if (filters.search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${filters.search}%` } },
        { description: { [Op.iLike]: `%${filters.search}%` } },
        { id: { [Op.iLike]: `%${filters.search}%` } },
      ];
    }

    const offset = (page - 1) * limit;

    const { rows: tickets, count: total } = await SupportTicket.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'email', 'city', 'state', 'address', 'role'],
          include: [
            {
              model: Clinic,
              as: 'clinic',
              attributes: ['id', 'name'],
            },
          ],
        },
        {
          model: User,
          as: 'assignedTo',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
        {
          model: User,
          as: 'lastUpdatedBy',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
        {
          model: Clinic,
          as: 'clinic',
          attributes: ['id', 'name'],
        },
      ],
      order: [['updatedAt', 'DESC']],
      limit,
      offset,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      tickets,
      total,
      page,
      totalPages,
    };
  }

  /**
   * Update ticket
   */
  async updateTicket(ticketId: string, data: UpdateTicketData, userId: string): Promise<SupportTicket> {
    const ticket = await SupportTicket.findByPk(ticketId);

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Update fields
    if (data.title !== undefined) ticket.title = data.title;
    if (data.description !== undefined) ticket.description = data.description;
    if (data.priority !== undefined) ticket.priority = data.priority;
    if (data.category !== undefined) ticket.category = data.category;
    if (data.assignedToId !== undefined) ticket.assignedToId = data.assignedToId;
    if (data.assignedTeam !== undefined) ticket.assignedTeam = data.assignedTeam;
    if (data.tags !== undefined) ticket.tags = data.tags;
    if (data.metadata !== undefined) ticket.metadata = data.metadata;

    // Track who made the last update
    ticket.lastUpdatedById = userId;

    // Handle status changes
    if (data.status !== undefined) {
      ticket.status = data.status;
      
      if (data.status === TicketStatus.RESOLVED && !ticket.resolvedAt) {
        ticket.resolvedAt = new Date();
      }
      
      if (data.status === TicketStatus.CLOSED && !ticket.closedAt) {
        ticket.closedAt = new Date();
      }
    }

    await ticket.save();

    // Reload with associations
    const updatedTicket = await SupportTicket.findByPk(ticketId, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'email', 'city', 'state', 'address', 'role'],
          include: [
            {
              model: Clinic,
              as: 'clinic',
              attributes: ['id', 'name'],
            },
          ],
        },
        {
          model: User,
          as: 'assignedTo',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
        {
          model: User,
          as: 'lastUpdatedBy',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
        {
          model: Clinic,
          as: 'clinic',
          attributes: ['id', 'name'],
        },
      ],
    });

    return updatedTicket!;
  }

  /**
   * Add message to ticket
   */
  async addMessage(data: AddMessageData): Promise<{ role: string; message: string; createdAt: string }> {
    const ticket = await SupportTicket.findByPk(data.ticketId);

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Get current messages array or initialize empty array
    const currentMessages = ticket.messages || [];
    
    // Create new message object
    const newMessage = {
      role: data.role,
      message: data.message,
      createdAt: new Date().toISOString(),
    };

    // Add new message to array
    const updatedMessages = [...currentMessages, newMessage];

    // Update ticket with new messages array and increment count
    ticket.messages = updatedMessages;
    ticket.messageCount = updatedMessages.length;
    await ticket.save();

    return newMessage;
  }

  /**
   * Get ticket statistics
   */
  async getStatistics(clinicId?: string): Promise<{
    total: number;
    new: number;
    inProgress: number;
    resolved: number;
    closed: number;
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
  }> {
    const whereClause: any = {};
    if (clinicId) {
      whereClause.clinicId = clinicId;
    }

    const tickets = await SupportTicket.findAll({
      where: whereClause,
      attributes: ['status', 'priority', 'category'],
    });

    const stats = {
      total: tickets.length,
      new: 0,
      inProgress: 0,
      resolved: 0,
      closed: 0,
      byPriority: {
        low: 0,
        medium: 0,
        high: 0,
        urgent: 0,
      },
      byCategory: {
        technical: 0,
        billing: 0,
        general: 0,
        feature_request: 0,
      },
    };

    tickets.forEach((ticket) => {
      // Count by status
      if (ticket.status === TicketStatus.NEW) stats.new++;
      if (ticket.status === TicketStatus.IN_PROGRESS) stats.inProgress++;
      if (ticket.status === TicketStatus.RESOLVED) stats.resolved++;
      if (ticket.status === TicketStatus.CLOSED) stats.closed++;

      // Count by priority
      stats.byPriority[ticket.priority]++;

      // Count by category
      stats.byCategory[ticket.category]++;
    });

    return stats;
  }

  /**
   * Delete ticket (soft delete)
   */
  async deleteTicket(ticketId: string): Promise<void> {
    const ticket = await SupportTicket.findByPk(ticketId);

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    await ticket.destroy();
  }
}

