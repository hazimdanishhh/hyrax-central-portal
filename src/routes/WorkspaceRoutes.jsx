import { Navigate, Route } from "react-router";
import Documents from "../pages/user/workspace/documents/Documents";
import Projects from "../pages/user/workspace/projects/Projects";
import Tasks from "../pages/user/workspace/tasks/Tasks";

export default (
  <Route path="workspace">
    {/* INDEX */}
    <Route index element={<Navigate to="projects" replace />} />

    <Route path="projects" element={<Projects />} />
    <Route path="tasks" element={<Tasks />} />
    <Route path="documents" element={<Documents />} />
  </Route>
);
