import { Workflow } from "./Workflow";
import { WorkflowStepStatus } from "./WorkflowStep";
import { WorkflowState } from "./WorkflowState";

export class WorkflowExecutor {
  public async execute(workflow: Workflow, signal?: AbortSignal): Promise<void> {
    workflow.start();
    workflow.context.logger.info(
      `Starting execution of workflow: ${workflow.name} (${workflow.id})`
    );

    let supervisor: any = null;
    let sessionId = "session-wf-" + workflow.id + "-" + Date.now();
    if (workflow.context.registry) {
      try {
        const token = { name: "IExecutionSupervisor" } as any;
        if (workflow.context.registry.has(token)) {
          supervisor = workflow.context.registry.resolve(token);
        }
      } catch (e) {}
    }

    if (supervisor) {
      try {
        const policy = {
          id: "pol-wf-" + workflow.id,
          name: "Workflow Default Policy",
          limits: {
            maxTokens: 10000,
            maxCost: 20,
            maxExecutionTimeMs: 120000,
            maxWorkflowDepth: 10,
            maxRecursion: 10,
            maxParallelJobs: 10,
            maxRetries: 5,
            maxAiCalls: 20,
            maxToolCalls: 20,
          },
          budget: {
            tokens: 10000,
            cost: 20,
            executionTimeMs: 120000,
            apiCalls: 20,
            providerUsage: {},
          },
          allowedRecoveries: ["retry", "rollback"],
        };

        const session = new (require("../supervisor/ExecutionBuilder").ExecutionBuilder)()
          .withId(sessionId)
          .withType("workflow")
          .withPolicy(policy as any)
          .withContext(workflow.context as any)
          .build();

        await supervisor.registerSession(session);
        await supervisor.updateSessionState(sessionId, "RUNNING" as any);
        await supervisor.consumeBudget(sessionId, 100, 0.2);
      } catch (e) {}
    }

    let currentStepId: string | undefined;
    try {
      for (const step of workflow.steps) {
        if (signal?.aborted || workflow.state === WorkflowState.CANCELLED) {
          throw new Error("Workflow execution cancelled.");
        }

        currentStepId = step.id;
        workflow.updateStepStatus(step.id, WorkflowStepStatus.RUNNING);

        if (supervisor) {
          try {
            await supervisor.createCheckpoint(sessionId, { currentStepId }, 50);
          } catch (e) {}
        }

        // Select step executor via Decision Engine if registered
        let decisionEngine: any = null;
        if (workflow.context.registry) {
          const token = { name: "IDecisionEngine" } as any;
          if (workflow.context.registry.has(token)) {
            decisionEngine = workflow.context.registry.resolve(token);
          }
        }

        if (decisionEngine) {
          const options = [];
          if (step.skillId) {
            options.push({ id: step.skillId, name: `Skill: ${step.skillId}`, cost: 1.0, reward: 5.0, risk: "LOW" as any });
          }
          if (step.agentId) {
            options.push({ id: step.agentId, name: `Agent: ${step.agentId}`, cost: 2.0, reward: 6.0, risk: "LOW" as any });
          }

          if (options.length > 0) {
            const builder = new (require("../decision/DecisionBuilder").DecisionBuilder)()
              .withId("dec-wf-step-" + step.id + "-" + Date.now())
              .withType(step.skillId ? "SKILL_SELECTION" : "PROVIDER_SELECTION" as any)
              .withPriority("NORMAL" as any)
              .withContext(workflow.context as any);

            for (const opt of options) {
              builder.addOption(opt);
            }

            builder.addCriteria({ name: "alignment", weight: 0.5 });
            builder.addCriteria({ name: "feasibility", weight: 0.5 });

            await decisionEngine.evaluate(builder.build());
          }
        }

        let output: unknown;

        if (step.skillId) {
          workflow.context.logger.info(
            `Executing step: ${step.name} (${step.id}) using skill: ${step.skillId}`
          );

          const skillRegistry =
            workflow.context.skillRegistry ||
            (workflow.context.registry.has({ name: "ISkillRegistry" } as any)
              ? (workflow.context.registry.resolve({ name: "ISkillRegistry" } as any) as any)
              : undefined);

          if (!skillRegistry) {
            throw new Error(`SkillRegistry not found in workflow context.`);
          }

          let abortHandler: () => void = () => {};
          const abortPromise = new Promise<never>((_, reject) => {
            if (signal?.aborted) {
              reject(new Error("cancelled"));
              return;
            }
            abortHandler = () => reject(new Error("cancelled"));
            signal?.addEventListener("abort", abortHandler);
          });

          const skillResult = await Promise.race([
            skillRegistry.execute(step.skillId, step.input),
            abortPromise,
          ]).finally(() => {
            if (signal && abortHandler) {
              signal.removeEventListener("abort", abortHandler);
            }
          });

          if (!skillResult.success) {
            throw new Error(skillResult.error || `Skill ${step.skillId} execution failed`);
          }
          output = skillResult.output;
        } else {
          if (!step.agentId) {
            throw new Error(`WorkflowStep ${step.id} has neither agentId nor skillId`);
          }
          workflow.context.logger.info(
            `Executing step: ${step.name} (${step.id}) using agent: ${step.agentId}`
          );

          // Lookup agent
          const agent = workflow.context.agentRegistry.get(step.agentId);
          if (!agent) {
            throw new Error(`Agent with ID ${step.agentId} not found in registry.`);
          }

          // Initialize agent if not READY
          if (agent.state === "CREATED") {
            await agent.initialize();
          }

          // Execute agent with cancellation race
          let abortHandler: () => void = () => {};
          const abortPromise = new Promise<never>((_, reject) => {
            if (signal?.aborted) {
              reject(new Error("cancelled"));
              return;
            }
            abortHandler = () => reject(new Error("cancelled"));
            signal?.addEventListener("abort", abortHandler);
          });

          output = await Promise.race([agent.execute(step.input), abortPromise]).finally(() => {
            if (signal && abortHandler) {
              signal.removeEventListener("abort", abortHandler);
            }
          });
        }

        workflow.updateStepStatus(step.id, WorkflowStepStatus.COMPLETED, output);
        workflow.context.logger.info(`Step completed: ${step.name} (${step.id})`);
      }

      workflow.complete();
      workflow.context.logger.info(
        `Workflow completed successfully: ${workflow.name} (${workflow.id})`
      );

      if (supervisor) {
        try {
          await supervisor.updateSessionState(sessionId, "COMPLETED" as any);
        } catch (e) {}
      }
    } catch (err: any) {
      if (supervisor) {
        try {
          await supervisor.recordFailure(sessionId, err);
          await supervisor.executeRecovery(sessionId);
        } catch (e) {}
      }
      if (signal?.aborted || err.message?.includes("cancelled")) {
        workflow.cancel();
        workflow.context.logger.warn(`Workflow cancelled: ${workflow.name} (${workflow.id})`);
      } else {
        if (currentStepId) {
          workflow.updateStepStatus(
            currentStepId,
            WorkflowStepStatus.FAILED,
            undefined,
            err.message
          );
        }
        workflow.fail();
        workflow.context.logger.error(
          `Workflow execution failed: ${workflow.name} (${workflow.id})`,
          {},
          err
        );
        throw err; // Propagate failure
      }
    }
  }
}
