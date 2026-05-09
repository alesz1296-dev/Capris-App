import { AppShell } from "../app-shell";
import { TaskAdmin } from "../task-admin";

export default function TasksPage() {
  return (
    <AppShell
      eyebrow={{ en: "Task operations", es: "Operacion de tareas" }}
      title={{ en: "Task planning and assignment", es: "Planificacion y asignacion de tareas" }}
      description={{
        en: "Manage field tasks, assignees, service dates, and route scope on their own dedicated page.",
        es: "Gestiona tareas de campo, responsables, fechas de servicio y alcance de ruta en su propia pagina."
      }}
    >
      <TaskAdmin />
    </AppShell>
  );
}
