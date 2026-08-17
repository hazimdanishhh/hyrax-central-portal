import { Navigate, Route } from "react-router";
import Documents from "../pages/user/workspace/documents/Documents";
import ProjectsManagement from "../pages/user/workspace/projects/list/ProjectsManagement";
import ProjectDetailLayout from "../pages/user/workspace/projects/detail/ProjectDetailLayout";
import ProjectTasksTab from "../pages/user/workspace/projects/detail/tasks/ProjectTasksTab";
import ProjectMembersTab from "../pages/user/workspace/projects/detail/members/ProjectMembersTab";
import MyTasks from "../pages/user/workspace/tasks/list/MyTasks";

// Overview tab cut per the product owner's decision (2026-08) -- project
// detail is 2 tabs (Tasks, Members), with the project's own fields shown
// in ProjectDetailLayout's own persistent header instead of a separate
// clickable tab. No <AccessRoute> anywhere in this file -- general access
// (req #10), matching supabase/access-control/README.md's own existing R2
// classification for Workspace ("no single department owns the data...
// unrestricted").
export default (
  <Route path="workspace">
    {/* INDEX */}
    <Route index element={<Navigate to="projects" replace />} />

    <Route path="projects">
      <Route index element={<ProjectsManagement />} />
      <Route path=":projectId" element={<ProjectDetailLayout />}>
        <Route index element={<Navigate to="tasks" replace />} />
        <Route path="tasks" element={<ProjectTasksTab />} />
        <Route path="members" element={<ProjectMembersTab />} />
      </Route>
    </Route>

    <Route path="tasks" element={<MyTasks />}>
      <Route path=":taskId" element={null} />
    </Route>
    <Route path="documents" element={<Documents />} />
  </Route>
);
