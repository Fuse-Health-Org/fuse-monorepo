import { Request, Response } from 'express';
import Sequence from '../../../models/Sequence';
import SequenceRun from '../../../models/SequenceRun';
import { getCurrentUser } from '../../../config/jwt';
import { calculateSequenceAnalytics } from '../services/sequences.service';
import { sequenceRunWorker } from '../services/worker';

/**
 * GET /sequences
 * List all sequences for the current user's clinic
 */
export const listSequences = async (req: Request, res: Response) => {
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

    const { status, refreshAnalytics } = req.query;

    const whereClause: any = {
      clinicId: currentUser.clinicId
    };

    if (status && typeof status === 'string') {
      whereClause.status = status;
      // If filtering by 'active' status, also filter by isActive flag
      if (status === 'active') {
        whereClause.isActive = true;
      }
    }

    const sequences = await Sequence.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    // Refresh analytics if requested (default: true for better UX)
    const shouldRefresh = refreshAnalytics !== 'false';
    
    if (shouldRefresh) {
      // Calculate analytics for all sequences in parallel
      await Promise.all(
        sequences.map(async (sequence) => {
          const analytics = await calculateSequenceAnalytics(sequence.id);
          sequence.analytics = analytics;
          await sequence.save();
        })
      );
    }

    res.status(200).json({
      success: true,
      data: sequences
    });
  } catch (error) {
    console.error('❌ Error fetching sequences:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sequences"
    });
  }
};

/**
 * GET /sequences/:id
 * Get a single sequence by ID
 */
export const getSequence = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const { id } = req.params;

    const sequence = await Sequence.findOne({
      where: {
        id,
        clinicId: currentUser.clinicId
      }
    });

    if (!sequence) {
      return res.status(404).json({
        success: false,
        message: "Sequence not found"
      });
    }

    res.status(200).json({
      success: true,
      data: sequence
    });
  } catch (error) {
    console.error('❌ Error fetching sequence:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sequence"
    });
  }
};

/**
 * POST /sequences
 * Create a new sequence
 */
export const createSequence = async (req: Request, res: Response) => {
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

    const { name, triggerEvent } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required"
      });
    }

    if (!triggerEvent || typeof triggerEvent !== 'string') {
      return res.status(400).json({
        success: false,
        message: "Trigger event is required"
      });
    }

    const triggerPayload = {
      event: triggerEvent,
      type: triggerEvent
    };

    const analyticsPayload = {
      totalSent: 0,
      openRate: 0,
      clickRate: 0,
      activeContacts: 0
    };

    const sequence = await Sequence.create({
      clinicId: currentUser.clinicId,
      name: name.trim(),
      description: null,
      status: 'draft',
      trigger: triggerPayload,
      steps: [],
      audience: null,
      analytics: analyticsPayload,
      isActive: false,
      createdBy: currentUser.id,
      updatedBy: currentUser.id
    });

    res.status(201).json({
      success: true,
      data: sequence
    });
  } catch (error) {
    console.error('❌ Error creating sequence:', error);
    res.status(500).json({
      success: false,
      message: "Failed to create sequence"
    });
  }
};

/**
 * PUT /sequences/:id/steps
 * Update sequence steps
 */
export const updateSequenceSteps = async (req: Request, res: Response) => {
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

    const { id } = req.params;
    const { steps } = req.body;

    if (!Array.isArray(steps)) {
      return res.status(400).json({
        success: false,
        message: "Steps must be an array"
      });
    }

    const sequence = await Sequence.findOne({
      where: {
        id,
        clinicId: currentUser.clinicId
      }
    });

    if (!sequence) {
      return res.status(404).json({
        success: false,
        message: "Sequence not found"
      });
    }

    const sanitizedSteps: Array<Record<string, unknown>> = [];

    for (let index = 0; index < steps.length; index += 1) {
      const rawStep = steps[index];
      if (!rawStep || typeof rawStep !== "object") {
        return res.status(400).json({
          success: false,
          message: `Invalid step payload at index ${index}`
        });
      }

      const stepIdRaw =
        typeof (rawStep as any).id === "string"
          ? (rawStep as any).id
          : typeof (rawStep as any).step_id === "string"
            ? (rawStep as any).step_id
            : undefined;

      if (!stepIdRaw || !stepIdRaw.trim()) {
        return res.status(400).json({
          success: false,
          message: `Missing step id at index ${index}`
        });
      }

      const stepId = stepIdRaw.trim();

      const stepTypeRaw = typeof rawStep.type === "string"
        ? rawStep.type
        : typeof (rawStep as any).stepType === "string"
          ? (rawStep as any).stepType
          : undefined;

      if (!stepTypeRaw) {
        return res.status(400).json({
          success: false,
          message: `Missing step type at index ${index}`
        });
      }

      const stepType = stepTypeRaw.toLowerCase();

      if (stepType === "delay") {
        const candidateTime =
          typeof (rawStep as any).timeSeconds === "number"
            ? (rawStep as any).timeSeconds
            : typeof (rawStep as any).time_seconds === "number"
              ? (rawStep as any).time_seconds
              : typeof (rawStep as any).time === "number"
                ? (rawStep as any).time
                : typeof (rawStep as any).delay === "number"
                  ? (rawStep as any).delay
                  : 0;

        if (!Number.isFinite(candidateTime) || candidateTime < 0) {
          return res.status(400).json({
            success: false,
            message: `Invalid delay time at index ${index}`
          });
        }

        sanitizedSteps.push({
          id: stepId,
          type: "delay",
          timeSeconds: Math.floor(candidateTime)
        });
        continue;
      }

      if (stepType === "email" || stepType === "sms") {
        const templateIdRaw =
          typeof (rawStep as any).templateId === "string"
            ? (rawStep as any).templateId
            : typeof (rawStep as any).template_id === "string"
              ? (rawStep as any).template_id
              : undefined;

        if (templateIdRaw !== undefined && templateIdRaw.trim() === "") {
          return res.status(400).json({
            success: false,
            message: `Invalid template id at index ${index}`
          });
        }

        const sanitizedStep: Record<string, unknown> = {
          type: stepType
        };

        // Check if using custom text
        const useCustomText = 
          typeof (rawStep as any).useCustomText === "boolean"
            ? (rawStep as any).useCustomText
            : false;

        // Save the mode (template vs custom)
        sanitizedStep.useCustomText = useCustomText;

        // Handle custom text steps
        if (useCustomText) {
          const customText = typeof (rawStep as any).customText === "string"
            ? (rawStep as any).customText
            : "";

          sanitizedStep.customText = customText;

          // For email, also save custom subject
          const customSubject = typeof (rawStep as any).customSubject === "string"
            ? (rawStep as any).customSubject
            : undefined;

          if (customSubject !== undefined) {
            sanitizedStep.customSubject = customSubject;
          }

          // Save merge fields for custom text
          const customMergeFields = Array.isArray((rawStep as any).customMergeFields)
            ? (rawStep as any).customMergeFields
            : undefined;

          if (customMergeFields !== undefined) {
            sanitizedStep.customMergeFields = customMergeFields;
          }
        } else {
          // Handle template-based steps
          if (templateIdRaw !== undefined) {
            sanitizedStep.templateId = templateIdRaw;
          }
        }

        sanitizedSteps.push({
          id: stepId,
          ...sanitizedStep
        });
        continue;
      }

      return res.status(400).json({
        success: false,
        message: `Unsupported step type "${stepType}" at index ${index}`
      });
    }

    sequence.steps = sanitizedSteps;
    sequence.updatedBy = currentUser.id;

    await sequence.save();

    res.status(200).json({
      success: true,
      data: sequence
    });
  } catch (error) {
    console.error("❌ Error updating sequence steps:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update sequence steps"
    });
  }
};

/**
 * PUT /sequences/:id
 * Update sequence metadata
 */
export const updateSequence = async (req: Request, res: Response) => {
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

    const { id } = req.params;
    const { name, description, triggerEvent, status } = req.body ?? {};

    if (
      name !== undefined &&
      (typeof name !== "string" || !name.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Name must be a non-empty string"
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be a string"
      });
    }

    if (
      triggerEvent !== undefined &&
      (typeof triggerEvent !== "string" || !triggerEvent.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Trigger event must be a non-empty string"
      });
    }

    const allowedStatuses = ["draft", "active", "paused", "archived"] as const;
    if (
      status !== undefined &&
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowedStatuses.join(", ")}`
      });
    }

    const sequence = await Sequence.findOne({
      where: {
        id,
        clinicId: currentUser.clinicId
      }
    });

    if (!sequence) {
      return res.status(404).json({
        success: false,
        message: "Sequence not found"
      });
    }

    if (name !== undefined) {
      sequence.name = name.trim();
    }

    if (description !== undefined) {
      sequence.description = description === null ? null : description;
    }

    if (triggerEvent !== undefined) {
      sequence.trigger = {
        event: triggerEvent,
        type: triggerEvent
      };
    }

    if (status !== undefined) {
      sequence.status = status;
      sequence.isActive = status === "active";
    }

    sequence.updatedBy = currentUser.id;

    await sequence.save();

    res.status(200).json({
      success: true,
      data: sequence
    });
  } catch (error) {
    console.error("❌ Error updating sequence:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update sequence"
    });
  }
};

/**
 * POST /sequence-triggers/manual
 * Manually trigger a sequence for a specific user
 */
export const triggerManual = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const { userId, tagId, sequenceId } = req.body ?? {};

    // Must provide either userId or tagId, but not both
    if (!userId && !tagId) {
      return res.status(400).json({
        success: false,
        message: "Either userId or tagId is required"
      });
    }

    if (userId && tagId) {
      return res.status(400).json({
        success: false,
        message: "Cannot specify both userId and tagId. Please choose one."
      });
    }

    if (!sequenceId || typeof sequenceId !== "string") {
      return res.status(400).json({
        success: false,
        message: "sequenceId is required"
      });
    }

    // Verify sequence exists, is active, and belongs to the same clinic
    const sequence = await Sequence.findOne({
      where: {
        id: sequenceId,
        clinicId: currentUser.clinicId,
        status: 'active',
        isActive: true
      }
    });

    if (!sequence) {
      return res.status(404).json({
        success: false,
        message: "Active sequence not found"
      });
    }

    const { default: User } = await import('../../../models/User');
    let targetUsers: any[] = [];

    // Get target users based on userId or tagId
    if (userId) {
      // Single user trigger
      const targetUser = await User.findOne({
        where: {
          id: userId,
          clinicId: currentUser.clinicId
        }
      });

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: "User not found or doesn't belong to your clinic"
        });
      }

      targetUsers = [targetUser];
    } else if (tagId) {
      // Tag-based trigger: get all users with this tag
      const { default: Tag } = await import('../../../models/Tag');
      const { default: UserTag } = await import('../../../models/UserTag');

      // Verify tag exists and belongs to clinic
      const tag = await Tag.findOne({
        where: {
          id: tagId,
          clinicId: currentUser.clinicId
        }
      });

      if (!tag) {
        return res.status(404).json({
          success: false,
          message: "Tag not found or doesn't belong to your clinic"
        });
      }

      // Get all users with this tag
      const userTags = await UserTag.findAll({
        where: { tagId },
        include: [
          {
            model: User,
            as: 'user',
            where: { 
              clinicId: currentUser.clinicId,
              role: 'patient'
            }
          }
        ]
      });

      targetUsers = userTags.map(ut => ut.user);

      if (targetUsers.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No users found with this tag"
        });
      }

      console.log(`🏷️ Triggering sequence "${sequence.name}" for ${targetUsers.length} users with tag "${tag.name}"`);
    }

    // Create sequence runs for all target users
    const sequenceRuns = await Promise.all(
      targetUsers.map(async (targetUser) => {
        // Build payload with user information
        const payload = {
          userId: targetUser.id,
          userEmail: targetUser.email,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
          phoneNumber: targetUser.phoneNumber,
          triggeredBy: currentUser.id,
          triggeredAt: new Date().toISOString(),
          tagId: tagId || undefined // Include tagId if triggered by tag
        };

        // Create sequence run (just DB insert, fast)
        return await SequenceRun.create({
          sequenceId: sequence.id,
          clinicId: currentUser.clinicId,
          triggerEvent: "manual",
          status: "pending",
          payload
        });
      })
    );

    // Return response immediately (don't block on enqueueing)
    const responseData = userId ? {
      // Single user response
      success: true,
      data: {
        sequenceRunId: sequenceRuns[0].id,
        sequenceId: sequence.id,
        sequenceName: sequence.name,
        userId: targetUsers[0].id,
        userName: `${targetUsers[0].firstName} ${targetUsers[0].lastName}`
      }
    } : {
      // Tag-based response
      success: true,
      data: {
        sequenceId: sequence.id,
        sequenceName: sequence.name,
        tagId,
        usersTriggered: targetUsers.length,
        sequenceRunIds: sequenceRuns.map(sr => sr.id)
      },
      message: `Sequence triggered for ${targetUsers.length} users`
    };

    res.status(201).json(responseData);

    // Enqueue runs asynchronously in the background (fire-and-forget)
    if (sequenceRunWorker) {
      // Don't await - let it run in background
      Promise.all(
        sequenceRuns.map(run => sequenceRunWorker.enqueueRun(run.id))
      ).catch(error => {
        console.error('❌ Error enqueueing sequence runs:', error);
      });
      
      console.log(`✅ Enqueuing ${sequenceRuns.length} sequence runs in background`);
    } else {
      console.warn('⚠️ Sequence run worker not initialized');
    }

  } catch (error) {
    console.error("❌ Error triggering manual sequence:", error);
    res.status(500).json({
      success: false,
      message: "Failed to trigger sequence manually"
    });
  }
};

/**
 * POST /sequence-triggers/checkout
 * Trigger a sequence on checkout event
 */
export const triggerCheckout = async (req: Request, res: Response) => {
  try {
    const { clinicId, payload } = req.body ?? {};

    if (!clinicId || typeof clinicId !== "string") {
      return res.status(400).json({
        success: false,
        message: "clinicId is required"
      });
    }

    const activeSequences = await Sequence.findAll({
      where: {
        clinicId,
        status: "active",
        isActive: true
      },
      order: [["updatedAt", "DESC"]]
    });

    const matchingSequence = activeSequences.find(sequence => {
      if (!sequence?.trigger || typeof sequence.trigger !== "object") {
        return false;
      }
      const triggerData = sequence.trigger as Record<string, unknown>;
      const triggerEvent = (triggerData.event || triggerData.eventKey || triggerData.type) as string | undefined;
      return triggerEvent === "checkout_completed";
    });

    if (!matchingSequence) {
      return res.status(404).json({
        success: false,
        message: "No active sequence found for checkout trigger"
      });
    }

    const sequenceRun = await SequenceRun.create({
      sequenceId: matchingSequence.id,
      clinicId,
      triggerEvent: "checkout_completed",
      status: "pending",
      payload: payload ?? null
    });

    res.status(201).json({
      success: true,
      data: {
        sequenceRunId: sequenceRun.id,
        sequenceId: matchingSequence.id
      }
    });

    if (sequenceRunWorker) {
      await sequenceRunWorker.enqueueRun(sequenceRun.id);
    } else {
      console.warn('⚠️ Sequence run worker not initialized');
    }
  } catch (error) {
    console.error("❌ Error triggering checkout sequence:", error);
    res.status(500).json({
      success: false,
      message: "Failed to trigger sequence for checkout"
    });
  }
};

/**
 * POST /sequences/:id/refresh-analytics
 * Manually refresh analytics for a sequence
 */
export const refreshAnalytics = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const { id } = req.params;

    const sequence = await Sequence.findOne({
      where: {
        id,
        clinicId: currentUser.clinicId
      }
    });

    if (!sequence) {
      return res.status(404).json({
        success: false,
        message: "Sequence not found"
      });
    }

    const analytics = await calculateSequenceAnalytics(id);

    sequence.analytics = analytics;
    await sequence.save();

    res.status(200).json({
      success: true,
      data: {
        sequenceId: id,
        analytics
      }
    });
  } catch (error) {
    console.error("❌ Error refreshing sequence analytics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to refresh analytics"
    });
  }
};

/**
 * GET /sequence-runs
 * List all sequence runs with optional filters
 */
export const listSequenceRuns = async (req: Request, res: Response) => {
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

    const { sequenceId, status, limit = '50', offset = '0' } = req.query;

    const whereClause: any = {
      clinicId: currentUser.clinicId
    };

    if (sequenceId && typeof sequenceId === 'string') {
      whereClause.sequenceId = sequenceId;
    }

    if (status && typeof status === 'string') {
      whereClause.status = status;
    }

    const parsedLimit = parseInt(limit as string, 10);
    const parsedOffset = parseInt(offset as string, 10);

    const { count, rows: runs } = await SequenceRun.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Sequence,
          as: 'sequence',
          attributes: ['id', 'name', 'status']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: Number.isFinite(parsedLimit) ? parsedLimit : 50,
      offset: Number.isFinite(parsedOffset) ? parsedOffset : 0
    });

    res.status(200).json({
      success: true,
      data: {
        runs,
        total: count,
        limit: parsedLimit,
        offset: parsedOffset
      }
    });
  } catch (error) {
    console.error("❌ Error fetching sequence runs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sequence runs"
    });
  }
};

/**
 * GET /sequence-runs/:id
 * Get a single sequence run by ID
 */
export const getSequenceRun = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const { id } = req.params;

    const run = await SequenceRun.findOne({
      where: {
        id,
        clinicId: currentUser.clinicId
      },
      include: [
        {
          model: Sequence,
          as: 'sequence'
        }
      ]
    });

    if (!run) {
      return res.status(404).json({
        success: false,
        message: "Sequence run not found"
      });
    }

    res.status(200).json({
      success: true,
      data: run
    });
  } catch (error) {
    console.error("❌ Error fetching sequence run:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sequence run"
    });
  }
};

/**
 * GET /track/email/:runId/open
 * Email tracking pixel endpoint
 */
export const trackEmailOpen = async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const run = await SequenceRun.findByPk(runId);

    if (run) {
      // Increment open counter only once per run (idempotent)
      if (run.emailsOpened === 0) {
        run.emailsOpened = 1;
        await run.save();
        
        // Update sequence analytics
        const sequence = await Sequence.findByPk(run.sequenceId);
        if (sequence) {
          const analytics = await calculateSequenceAnalytics(run.sequenceId);
          sequence.analytics = analytics;
          await sequence.save();
        }
        
        console.log(`📧 Email opened tracked for run ${runId}`);
      }
    }

    // Return 1x1 transparent GIF
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Content-Length', pixel.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(pixel);
  } catch (error) {
    console.error("❌ Error tracking email open:", error);
    // Still return pixel even on error
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );
    res.setHeader('Content-Type', 'image/gif');
    res.send(pixel);
  }
};

