import {
  Calendar,
  Folders,
  ListDashes,
  SquaresFour,
  Wallet,
} from "phosphor-react";

export const quickActionsHome = [
  {
    icon: SquaresFour,
    name: "Create Project",
    path: "/app/workspace/projects",
  },
  {
    icon: ListDashes,
    name: "Create Task",
    path: "/app/workspace/tasks",
  },
  {
    icon: Folders,
    name: "Add Document",
    path: "/app/workspace/documents",
  },
  {
    icon: Calendar,
    name: "Create Leave Request",
    path: "https://www.iloginhr.com/loginbs.aspx",
  },
  {
    icon: Wallet,
    name: "Create Expense Claim",
    path: "/app/employee/claims",
  },
];
