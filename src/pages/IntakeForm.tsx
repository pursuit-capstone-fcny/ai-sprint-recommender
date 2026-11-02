const GOAL_MAX_LENGTH = 500;

interface IntakeFormProps {
  goalText: string;
  onGoalTextChange: (value: string) => void;
}

export function IntakeForm({ goalText, onGoalTextChange }: IntakeFormProps) {
  return (
    <div className="field discovery-field">
      <label htmlFor="goal">Your goal</label>
      <textarea
        id="goal"
        value={goalText}
        maxLength={GOAL_MAX_LENGTH}
        aria-describedby="goal-help"
        placeholder="For example, I coordinate volunteers and need help planning outreach."
        autoComplete="off"
        onChange={(event) =>
          onGoalTextChange(event.target.value.slice(0, GOAL_MAX_LENGTH))
        }
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <p id="goal-help" className="field-help">
        Describe a task, your role, your organization's mission or a learning
        need. Up to 500 characters. Enter to search; Shift+Enter for a new line.
      </p>
    </div>
  );
}
