import { useRef } from 'react';
import { FUNCTION_AREAS } from '../contracts/functionAreas';

const GOAL_MAX_LENGTH = 500;

interface IntakeFormProps {
  functionArea: string | null;
  onFunctionAreaChange: (value: string | null) => void;
  goalText: string;
  onGoalTextChange: (value: string) => void;
  availableTools: string[];
  availableFunctionAreas?: readonly string[];
  selectedTools: string[];
  onToggleTool: (tool: string) => void;
}

export function IntakeForm({
  functionArea,
  onFunctionAreaChange,
  goalText,
  onGoalTextChange,
  availableTools,
  availableFunctionAreas = FUNCTION_AREAS,
  selectedTools,
  onToggleTool,
}: IntakeFormProps) {
  const goalInput = useRef<HTMLInputElement>(null);
  const refinements = [functionArea, ...selectedTools].filter(Boolean);

  // The select holds at most one tool. It drives the same toggle callback the
  // profile already uses: untoggle whatever is picked, then toggle the new one.
  function handleToolChange(nextTool: string) {
    for (const tool of selectedTools) onToggleTool(tool);
    if (nextTool) onToggleTool(nextTool);
  }

  return (
    <fieldset className="intake-form">
      <legend className="sr-only">Tell us what you're working on</legend>

      <div className="field discovery-field">
        <label htmlFor="goal">What do you want to learn or do?</label>
        <p id="goal-help" className="field-help">
          Describe a task, your role, your organization's mission or a learning
          need in your own words. Up to 500 characters.
        </p>
        <input
          ref={goalInput}
          id="goal"
          type="text"
          value={goalText}
          maxLength={GOAL_MAX_LENGTH}
          aria-describedby="goal-help"
          placeholder="e.g. I coordinate volunteers and need help planning outreach"
          autoComplete="off"
          onChange={(event) =>
            onGoalTextChange(event.target.value.slice(0, GOAL_MAX_LENGTH))
          }
        />
        <div className="discovery-examples" aria-label="Example searches">
          <span>Try an example:</span>
          {[
            ['Task', 'Draft a grant report'],
            ['Role', 'I coordinate volunteers and need help planning outreach'],
            ['Mission', 'Our nonprofit helps families find housing'],
          ].map(([kind, example]) => (
            <button
              key={kind}
              type="button"
              className="example-search"
              onClick={() => {
                onGoalTextChange(example);
                goalInput.current?.focus();
              }}
            >
              <span>{kind}:</span> {example}
            </button>
          ))}
        </div>
      </div>

      <details className="intake-refinements">
        <summary>
          Refine by function area or tool (optional)
          {refinements.length > 0 && (
            <span className="refinement-selection">
              {' '}
              · {refinements.join(', ')}
            </span>
          )}
        </summary>
        <div className="refinement-fields">
          <div className="field">
            <label htmlFor="function-area">Function area (optional)</label>
            <select
              id="function-area"
              value={functionArea ?? ''}
              onChange={(event) =>
                onFunctionAreaChange(event.target.value || null)
              }
            >
              <option value="">Any function area</option>
              {availableFunctionAreas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="tool">Tool (optional)</label>
            <select
              id="tool"
              value={selectedTools[0] ?? ''}
              onChange={(event) => handleToolChange(event.target.value)}
            >
              <option value="">Any AI tool</option>
              {availableTools.map((tool) => (
                <option key={tool} value={tool}>
                  {tool}
                </option>
              ))}
            </select>
          </div>
        </div>
      </details>
    </fieldset>
  );
}
