import { Navigate, Route } from "react-router";
import Documents from "../pages/user/workspace/documents/Documents";
import ProjectsManagement from "../pages/user/workspace/projects/list/ProjectsManagement";
import ProjectDetailLayout from "../pages/user/workspace/projects/detail/ProjectDetailLayout";
import ProjectOverviewTab from "../pages/user/workspace/projects/detail/overview/ProjectOverviewTab";
import ProjectTasksTab from "../pages/user/workspace/projects/detail/tasks/ProjectTasksTab";
import ProjectMembersTab from "../pages/user/workspace/projects/detail/members/ProjectMembersTab";
import ProjectDocumentsTab from "../pages/user/workspace/projects/detail/documents/ProjectDocumentsTab";
import MyTasks from "../pages/user/workspace/tasks/list/MyTasks";

// Project detail is 4 tabs (Tasks, Members, Documents, Overview) --
// Overview was originally cut per a 2026-08 product-owner decision, then
// reinstated 2026-09 as a real per-project KPI/chart dashboard once the
// module had grown analytical content worth a dedicated tab (see
// ProjectDetailLayout.jsx's own header comment and
// docs/PROJECTS-TASKS-ARCHITECTURE.md). `index` still redirects to
// `tasks`, unchanged -- Overview is additive, not the new default. No
// <AccessRoute> anywhere in this file -- general access (req #10),
// matching supabase/access-control/README.md's own existing R2
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
        <Route path="tasks" element={<ProjectTasksTab />}>
          <Route path=":taskId" element={null} />
        </Route>
        <Route path="members" element={<ProjectMembersTab />} />
        <Route path="documents" element={<ProjectDocumentsTab />} />
        <Route path="overview" element={<ProjectOverviewTab />} />
      </Route>
    </Route>

    <Route path="tasks" element={<MyTasks />}>
      <Route path=":taskId" element={null} />
    </Route>
    <Route path="documents" element={<Documents />} />
  </Route>
);
