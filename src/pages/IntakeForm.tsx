import { FUNCTION_AREAS } from '../contracts/functionAreas';

const GOAL_MAX_LENGTH = 500;

interface IntakeFormProps {
  functionArea: string | null;
  onFunctionAreaChange: (value: string | null) => void;
  goalText: string;
  onGoalTextChange: (value: string) => void;
  availableTools: string[];
  selectedTools: string[];
  onToggleTool: (tool: string) => void;
}

export function IntakeForm({
  functionArea,
  onFunctionAreaChange,
  goalText,
  onGoalTextChange,
  availableTools,
  selectedTools,
  onToggleTool,
}: IntakeFormProps) {
  return (
    <fieldset className="intake-form">
      <legend className="sr-only">Tell us what you're working on</legend>

      <div className="field">
        <label htmlFor="function-area">Function area</label>
        <select
          id="function-area"
          value={functionArea ?? ''}
          onChange={(event) => onFunctionAreaChange(event.target.value || null)}
        >
          <option value="">Not sure</option>
          {FUNCTION_AREAS.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
        <p className="helper-text">
          Pick the area closest to your work, or "Not sure" to see picks from
          anywhere.
        </p>
      </div>

      <div className="field">
        <label htmlFor="goal">What are you trying to do?</label>
        <textarea
          id="goal"
          value={goalText}
          maxLength={GOAL_MAX_LENGTH}
          onChange={(event) => onGoalTextChange(event.target.value)}
          rows={2}
        />
        <p className="helper-text">Optional. A few words is enough.</p>
      </div>

      {availableTools.length > 0 && (
        <div className="field">
          <span id="tools-label">Tools you use</span>
          <div
            className="tool-chips"
            role="group"
            aria-labelledby="tools-label"
          >
            {availableTools.map((tool) => {
              const selected = selectedTools.includes(tool);
              return (
                <button
                  key={tool}
                  type="button"
                  className="tool-chip"
                  aria-pressed={selected}
                  onClick={() => onToggleTool(tool)}
                >
                  {tool}
                </button>
              );
            })}
          </div>
          <p className="helper-text">Optional. Pick as many as apply.</p>
        </div>
      )}
    </fieldset>
  );
}
