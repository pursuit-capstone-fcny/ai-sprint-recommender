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
  // The select holds at most one tool. It drives the same toggle callback the
  // profile already uses: untoggle whatever is picked, then toggle the new one.
  function handleToolChange(nextTool: string) {
    for (const tool of selectedTools) onToggleTool(tool);
    if (nextTool) onToggleTool(nextTool);
  }

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
          {availableFunctionAreas.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="goal">What do you want to learn?</label>
        <input
          id="goal"
          type="text"
          value={goalText}
          maxLength={GOAL_MAX_LENGTH}
          placeholder="e.g. write a grant report, summarize meeting notes"
          autoComplete="off"
          onChange={(event) => onGoalTextChange(event.target.value)}
        />
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
    </fieldset>
  );
}
