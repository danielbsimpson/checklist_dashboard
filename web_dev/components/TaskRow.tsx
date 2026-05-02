/**
 * TaskRow.tsx
 * -----------
 * A single tappable task row styled as a checkbox.
 * Renders the task label with a "☐" prefix; the parent handles state and saving.
 */
import { Pressable, StyleSheet, Text } from "react-native";

interface Props {
  task: string;
  onPress: () => void;
  /** Disable tapping while a save is in-flight for this task. */
  saving?: boolean;
}

export default function TaskRow({ task, onPress, saving = false }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        saving && styles.rowSaving,
      ]}
      onPress={saving ? undefined : onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: false }}
      accessibilityLabel={task}
    >
      <Text style={styles.checkbox}>{saving ? "⋯" : "☐"}</Text>
      <Text style={[styles.label, saving && styles.labelSaving]}>{task}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2d2f30",
    gap: 10,
  },
  rowPressed: {
    backgroundColor: "#1e2628",
    borderRadius: 6,
  },
  rowSaving: {
    opacity: 0.5,
  },
  checkbox: {
    fontSize: 20,
    color: "#9BA1A6",
    width: 24,
    textAlign: "center",
  },
  label: {
    flex: 1,
    fontSize: 15,
    color: "#ECEDEE",
    lineHeight: 22,
  },
  labelSaving: {
    color: "#9BA1A6",
  },
});
