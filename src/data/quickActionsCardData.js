import {
  CalendarIcon,
  FoldersIcon,
  ListDashesIcon,
  SquaresFourIcon,
  WalletIcon,
} from "@phosphor-icons/react";

export const quickActionsHome = [
  {
    icon: SquaresFourIcon,
    name: "Create Project",
    path: "/app/workspace/projects",
  },
  {
    icon: ListDashesIcon,
    name: "Create Task",
    path: "/app/workspace/tasks",
  },
  {
    icon: FoldersIcon,
    name: "Add Document",
    path: "/app/workspace/documents",
  },
  {
    icon: CalendarIcon,
    name: "Create Leave Request",
    path: "https://www.iloginhr.com/loginbs.aspx",
  },
  {
    icon: WalletIcon,
    name: "Create Expense Claim",
    path: "/app/employee/claims",
  },
];
