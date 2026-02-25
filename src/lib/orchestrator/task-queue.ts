import { prisma } from "@/lib/prisma";
import type { AgentName } from "@prisma/client";

export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface QueuedTask {
  id: string;
  agent: AgentName;
  organizationId: string;
  priority: Priority;
  reason: string;
  input?: Record<string, unknown>;
  createdAt: Date;
  attempts: number;
  maxAttempts: number;
  lockedAt?: Date;
  lockedBy?: string;
}

export interface TaskQueueStats {
  total: number;
  pending: number;
  processing: number;
  failed: number;
  byPriority: Record<Priority, number>;
}

const PRIORITY_ORDER: Record<Priority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export function priorityOrder(p: Priority): number {
  return PRIORITY_ORDER[p];
}

export class TaskQueue {
  private queue: Map<string, QueuedTask> = new Map();
  private processing: Set<string> = new Set();

  async enqueue(task: Omit<QueuedTask, "id" | "createdAt" | "attempts">): Promise<string> {
    const id = crypto.randomUUID();
    const queuedTask: QueuedTask = {
      ...task,
      id,
      createdAt: new Date(),
      attempts: 0,
    };

    this.queue.set(id, queuedTask);

    await this.persistTask(queuedTask);

    return id;
  }

  async enqueueBatch(tasks: Array<Omit<QueuedTask, "id" | "createdAt" | "attempts">>): Promise<string[]> {
    const ids: string[] = [];

    for (const task of tasks) {
      const id = await this.enqueue(task);
      ids.push(id);
    }

    return ids;
  }

  async dequeue(agentName: string, organizationId?: string): Promise<QueuedTask | null> {
    const sortedTasks = Array.from(this.queue.values())
      .filter((task) => {
        if (task.agent !== agentName) return false;
        if (organizationId && task.organizationId !== organizationId) return false;
        if (this.processing.has(task.id)) return false;
        if (task.attempts >= task.maxAttempts) return false;
        return true;
      })
      .sort((a, b) => {
        const priorityDiff = priorityOrder(a.priority) - priorityOrder(b.priority);
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

    const task = sortedTasks[0];

    if (!task) {
      return null;
    }

    task.attempts++;
    task.lockedAt = new Date();
    this.processing.add(task.id);

    await this.updateTask(task);

    return task;
  }

  async complete(taskId: string): Promise<void> {
    this.queue.delete(taskId);
    this.processing.delete(taskId);
    await this.removeTask(taskId);
  }

  async fail(taskId: string, error?: string): Promise<void> {
    const task = this.queue.get(taskId);
    if (!task) return;

    if (task.attempts >= task.maxAttempts) {
      await this.escalateTask(task, error);
      this.queue.delete(taskId);
    }

    task.lockedAt = undefined;
    this.processing.delete(taskId);
    await this.updateTask(task);
  }

  async requeue(taskId: string): Promise<void> {
    const task = this.queue.get(taskId);
    if (!task) return;

    task.lockedAt = undefined;
    task.attempts--;
    this.processing.delete(taskId);
    await this.updateTask(task);
  }

  getStats(): TaskQueueStats {
    const stats: TaskQueueStats = {
      total: this.queue.size,
      pending: 0,
      processing: this.processing.size,
      failed: 0,
      byPriority: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    };

    for (const task of this.queue.values()) {
      if (task.lockedAt) {
        stats.processing++;
      } else {
        stats.pending++;
      }
      stats.byPriority[task.priority]++;
    }

    return stats;
  }

  async getPendingForAgent(agentName: AgentName, limit = 10): Promise<QueuedTask[]> {
    return Array.from(this.queue.values())
      .filter((task) => task.agent === agentName && !this.processing.has(task.id))
      .sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority))
      .slice(0, limit);
  }

  async getAllQueued(): Promise<QueuedTask[]> {
    return Array.from(this.queue.values()).sort(
      (a, b) => priorityOrder(a.priority) - priorityOrder(b.priority)
    );
  }

  private async persistTask(task: QueuedTask): Promise<void> {
    await prisma.agentLog.create({
      data: {
        organizationId: task.organizationId,
        agentName: task.agent,
        action: `QUEUED: ${task.reason}`,
        status: "SUCCESS",
      },
    });
  }

  private async updateTask(task: QueuedTask): Promise<void> {
    // In production, update the database
  }

  private async removeTask(taskId: string): Promise<void> {
    // In production, remove from database
  }

  private async escalateTask(task: QueuedTask, error?: string): Promise<void> {
    await prisma.escalation.create({
      data: {
        organizationId: task.organizationId,
        agentName: task.agent,
        reason: `Task failed after ${task.maxAttempts} attempts: ${task.reason}`,
        context: { taskId: task.id, error, attempts: task.attempts },
        priority: task.priority === "CRITICAL" ? "CRITICAL" : "HIGH",
        status: "OPEN",
      },
    });
  }
}

export const taskQueue = new TaskQueue();
