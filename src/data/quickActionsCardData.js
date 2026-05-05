import {
  CalendarIcon,
  FoldersIcon,
  ListDashesIcon,
  SquaresFourIcon,
  WalletIcon,
} from "@phosphor-icons/react";
import cloudflare from "/src/assets/icons/cloudflare.svg";
import synology from "/src/assets/icons/synology.svg";
import googlecloud from "/src/assets/icons/googlecloud.svg";
import bitwarden from "/src/assets/icons/bitwarden.svg";
import github from "/src/assets/icons/github.svg";
import hikconnect from "/src/assets/icons/hikconnect.svg";
import supabase from "/src/assets/icons/supabase.svg";
import manageengine from "/src/assets/icons/manageengine.svg";
import googleadminconsole from "/src/assets/icons/googleadminconsole.svg";
import render from "/src/assets/icons/render.svg";
import emailjs from "/src/assets/icons/emailjs.svg";
import googlesearchconsole from "/src/assets/icons/googlesearchconsole.svg";
import googledrive from "/src/assets/icons/googledrive.svg";
import gmail from "/src/assets/icons/gmail.svg";
import hyraxoil from "/src/assets/icons/hyraxoil.svg";
import uniflow from "/src/assets/icons/uniflow.svg";
import eoffice from "/src/assets/icons/eoffice.svg";

// GENERAL
export const quickActionsHome = [
  {
    name: "Gmail",
    path: "https://mail.google.com",
    target: "_blank",
    rel: "noopener noreferrer",
    image: gmail,
  },
  {
    name: "Google Drive",
    path: "https://drive.google.com",
    target: "_blank",
    rel: "noopener noreferrer",
    image: googledrive,
  },
  {
    name: "UniFLOW Online (Printer)",
    path: "https://hyraxoil.sg.uniflowonline.com/Login",
    target: "_blank",
    rel: "noopener noreferrer",
    image: uniflow,
  },
  {
    name: "E-Office",
    path: "https://www.iloginhr.com/",
    target: "_blank",
    rel: "noopener noreferrer",
    image: eoffice,
  },
  {
    name: "Hyrax Oil Website",
    path: "https://hyraxoil.com",
    target: "_blank",
    rel: "noopener noreferrer",
    image: hyraxoil,
  },
];

// TEST
export const quickActionsTest = [
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

// IT SYSTEMS
export const quickActionsIT = [
  {
    name: "Google Admin Console",
    path: "https://admin.google.com",
    target: "_blank",
    rel: "noopener noreferrer",
    image: googleadminconsole,
  },
  {
    name: "Cloudflare",
    path: "https://dash.cloudflare.com",
    target: "_blank",
    rel: "noopener noreferrer",
    image: cloudflare,
  },
  {
    name: "ManageEngine Endpoint Central",
    path: "https://endpointcentral.manageengine.com",
    target: "_blank",
    rel: "noopener noreferrer",
    image: manageengine,
  },
  {
    name: "Supabase",
    path: "https://supabase.com/dashboard",
    target: "_blank",
    rel: "noopener noreferrer",
    image: supabase,
  },
  {
    name: "Google Search Console",
    path: "https://search.google.com/search-console",
    target: "_blank",
    rel: "noopener noreferrer",
    image: googlesearchconsole,
  },
  {
    name: "Google Cloud",
    path: "https://console.cloud.google.com",
    target: "_blank",
    rel: "noopener noreferrer",
    image: googlecloud,
  },
  {
    name: "Render",
    path: "https://dashboard.render.com",
    target: "_blank",
    rel: "noopener noreferrer",
    image: render,
  },
  {
    name: "Bitwarden",
    path: "https://vault.bitwarden.com",
    target: "_blank",
    rel: "noopener noreferrer",
    image: bitwarden,
  },
  {
    name: "EmailJS (Hyrax Oil Website)",
    path: "https://dashboard.emailjs.com/admin",
    target: "_blank",
    rel: "noopener noreferrer",
    image: emailjs,
  },
  {
    name: "Synology QuickConnect",
    path: "https://quickconnect.to",
    target: "_blank",
    rel: "noopener noreferrer",
    image: synology,
  },
  {
    name: "HikConnect (CCTV)",
    path: "https://www.hik-connect.com/",
    target: "_blank",
    rel: "noopener noreferrer",
    image: hikconnect,
  },
  {
    name: "GitHub (Hyrax Oil)",
    path: "https://github.com/hyraxoilofficial",
    target: "_blank",
    rel: "noopener noreferrer",
    image: github,
  },
];
