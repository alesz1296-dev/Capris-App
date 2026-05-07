import { t } from "@capris/shared";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const tasks = [
  {
    id: "task_001",
    title: "Install display at POS",
    status: "Pending sync",
    requirements: ["Check-in GPS", "Before photo", "After photo"]
  }
];

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Costa Rica</Text>
          <Text style={styles.title}>{t("en", "app.name")}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Today&apos;s route</Text>
          {tasks.map((task) => (
            <View style={styles.task} key={task.id}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <Text style={styles.status}>{task.status}</Text>
              {task.requirements.map((requirement) => (
                <Text style={styles.requirement} key={requirement}>
                  {requirement}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Check in</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Add evidence</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#f3f7f4",
    flex: 1
  },
  container: {
    gap: 18,
    padding: 20
  },
  header: {
    gap: 6
  },
  eyebrow: {
    color: "#1f7a5b",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  title: {
    color: "#18211f",
    fontSize: 28,
    fontWeight: "800"
  },
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#dbe4df",
    borderRadius: 8,
    borderWidth: 1,
    padding: 16
  },
  sectionTitle: {
    color: "#18211f",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12
  },
  task: {
    gap: 8
  },
  taskTitle: {
    color: "#18211f",
    fontSize: 16,
    fontWeight: "700"
  },
  status: {
    color: "#5d6d67"
  },
  requirement: {
    color: "#15533e"
  },
  actions: {
    gap: 10
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#1f7a5b",
    borderRadius: 8,
    padding: 14
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#1f7a5b",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14
  },
  secondaryButtonText: {
    color: "#1f7a5b",
    fontWeight: "700"
  }
});

