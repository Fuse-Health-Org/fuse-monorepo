import User from "../models/User";
import MDMessagesService, {
  CreateMessagePayload,
  GetMessagesParams,
} from "./mdIntegration/MDMessages.service";

const MDI_ERROR_MESSAGE_MAP: Record<string, string> = {
  "patient not found":
    "Paciente no encontrado en MDI. Verifica el mdPatientId.",
  "provider not found":
    "Proveedor no encontrado en MDI. Revisa la configuración de credenciales.",
  "invalid channel": 'Canal inválido en MDI. Asegúrate de usar "patient" o "support".',
};

const normalizeMdiError = (error: unknown): string => {
  if (error instanceof Error) {
    const normalized = error.message.toLowerCase();
    const matched = Object.keys(MDI_ERROR_MESSAGE_MAP).find((key) =>
      normalized.includes(key)
    );
    if (matched) {
      return MDI_ERROR_MESSAGE_MAP[matched];
    }

    return "Error al procesar la solicitud con el servicio de mensajería";
  }

  return "Error desconocido al comunicar con MDI";
};

class MessageService {
  async getMessagesByUserId(userId: string, params: GetMessagesParams = {}) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.mdPatientId) {
      throw new Error("User does not have an MD Patient ID");
    }

    await user.update({
      newMessages: false,
    });

    try {
      // Use channel from params if provided, otherwise default to "patient"
      const channel = params.channel || "patient";
      return await MDMessagesService.getMessages(user.mdPatientId, {
        ...params,
        channel,
      });
    } catch (error) {
      throw new Error(normalizeMdiError(error));
    }
  }

  async createMessageForUser(userId: string, payload: CreateMessagePayload) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.mdPatientId) {
      throw new Error("User does not have an MD Patient ID");
    }

    try {
      return await MDMessagesService.createMessage(user.mdPatientId, payload);
    } catch (error) {
      throw new Error(normalizeMdiError(error));
    }
  }

  async markMessageAsReadForUser(userId: string, messageId: string) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.mdPatientId) {
      throw new Error("User does not have an MD Patient ID");
    }

    try {
      return await MDMessagesService.markMessageAsRead(
        user.mdPatientId,
        messageId
      );
    } catch (error) {
      throw new Error(normalizeMdiError(error));
    }
  }

  async markMessageAsUnreadForUser(userId: string, messageId: string) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.mdPatientId) {
      throw new Error("User does not have an MD Patient ID");
    }

    try {
      return await MDMessagesService.markMessageAsUnread(
        user.mdPatientId,
        messageId
      );
    } catch (error) {
      throw new Error(normalizeMdiError(error));
    }
  }
}

export default new MessageService();
