import { AgentMessage } from "./AgentMessage";
import { AgentPresence } from "./AgentPresence";
import { AgentTaskAssignment } from "./AgentTaskAssignment";
import { CollaborationValidationException } from "./types";

export class AgentCommunicationValidator {
  public validateMessage(message: { senderId: string; recipientId: string; priority: string; expiresAt?: Date }): void {
    if (!message.senderId || message.senderId.trim() === "") {
      throw new CollaborationValidationException("Sender ID cannot be empty.");
    }
    if (!message.recipientId || message.recipientId.trim() === "") {
      throw new CollaborationValidationException("Recipient ID cannot be empty.");
    }
    if (message.senderId === message.recipientId) {
      throw new CollaborationValidationException("Self messaging is not allowed (Self messaging).");
    }
    if (!["CRITICAL", "HIGH", "NORMAL", "LOW"].includes(message.priority)) {
      throw new CollaborationValidationException("Invalid message priority (Invalid priorities).");
    }
    if (message.expiresAt && message.expiresAt.getTime() < Date.now()) {
      throw new CollaborationValidationException("Message has expired (Expired messages).");
    }
  }

  public validateTaskTransition(
    current: string,
    target: "pending" | "accepted" | "rejected" | "processing" | "completed" | "failed" | "cancelled"
  ): void {
    const validTransitions: Record<string, string[]> = {
      pending: ["accepted", "rejected", "cancelled"],
      accepted: ["processing", "completed", "failed", "cancelled"],
      processing: ["completed", "failed", "cancelled"],
      rejected: [],
      completed: [],
      failed: [],
      cancelled: [],
    };

    const allowed = validTransitions[current] || [];
    if (!allowed.includes(target)) {
      throw new CollaborationValidationException(`Invalid task status transition from ${current} to ${target} (Invalid task transitions).`);
    }
  }

  public validateCircularDelegation(
    assigneeId: string,
    assignerId: string,
    tasks: Map<string, AgentTaskAssignment>
  ): void {
    // If the assignee is the assigner -> circular delegation
    if (assigneeId === assignerId) {
      throw new CollaborationValidationException("Assignee cannot be same as assigner.");
    }

    // Traverse assigners of assigner to see if assigner is delegating back to someone in the chain
    let currentAssignerId = assignerId;
    const seen = new Set<string>([assigneeId]);

    while (currentAssignerId) {
      if (seen.has(currentAssignerId)) {
        throw new CollaborationValidationException("Circular delegation detected in assignment path (Circular delegation).");
      }
      seen.add(currentAssignerId);

      // Find if this assigner has an active task assigned to them
      const parentTask = Array.from(tasks.values()).find(
        (t) => t.assigneeId === currentAssignerId && t.status !== "completed" && t.status !== "failed"
      );
      if (parentTask) {
        currentAssignerId = parentTask.assignerId;
      } else {
        break;
      }
    }
  }

  public validateHeartbeat(agentId: string, timestamp: Date): void {
    if (!agentId || agentId.trim() === "") {
      throw new CollaborationValidationException("Heartbeat agent ID cannot be empty.");
    }
    if (timestamp.getTime() > Date.now() + 5000) {
      throw new CollaborationValidationException("Heartbeat timestamp cannot be in the future (Invalid heartbeat).");
    }
  }
}
