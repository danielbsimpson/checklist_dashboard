/**
 * DateFilter.tsx
 * --------------
 * Collapsible date-range picker for the dashboard.
 * Uses plain TextInput (YYYY-MM-DD) — native DatePicker would require an
 * extra package; this keeps dependencies minimal and works identically on web.
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

interface Props {
  minDate: string;
  maxDate: string;
  startDate: string;
  endDate: string;
  onChangeStart: (d: string) => void;
  onChangeEnd: (d: string) => void;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function DateFilter({
  minDate, maxDate, startDate, endDate, onChangeStart, onChangeEnd,
}: Props) {
  const [open, setOpen] = useState(false);

  function handleStart(val: string) {
    if (ISO_RE.test(val) && val >= minDate && val <= endDate) {
      onChangeStart(val);
    }
  }

  function handleEnd(val: string) {
    if (ISO_RE.test(val) && val >= startDate && val <= maxDate) {
      onChangeEnd(val);
    }
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.header} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.headerText}>
          🗓️ {startDate} → {endDate}
        </Text>
        <Text style={styles.chevron}>{open ? "▲" : "▼"}</Text>
      </Pressable>

      {open && (
        <View style={styles.body}>
          <View style={styles.row}>
            <Text style={styles.fieldLabel}>From</Text>
            <TextInput
              style={styles.input}
              defaultValue={startDate}
              onEndEditing={(e) => handleStart(e.nativeEvent.text.trim())}
              placeholder={minDate}
              placeholderTextColor="#9BA1A6"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.fieldLabel}>To</Text>
            <TextInput
              style={styles.input}
              defaultValue={endDate}
              onEndEditing={(e) => handleEnd(e.nativeEvent.text.trim())}
              placeholder={maxDate}
              placeholderTextColor="#9BA1A6"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          </View>
          <Text style={styles.hint}>Format: YYYY-MM-DD</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1c1e1f",
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#2d2f30",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  headerText: {
    flex: 1,
    color: "#9BA1A6",
    fontSize: 13,
  },
  chevron: {
    color: "#9BA1A6",
    fontSize: 11,
  },
  body: {
    padding: 12,
    paddingTop: 0,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fieldLabel: {
    width: 32,
    color: "#9BA1A6",
    fontSize: 13,
  },
  input: {
    flex: 1,
    backgroundColor: "#151718",
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#2d2f30",
    color: "#ECEDEE",
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  hint: {
    color: "#686e72",
    fontSize: 11,
    marginTop: 2,
  },
});
