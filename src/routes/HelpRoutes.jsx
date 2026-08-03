import { Navigate, Route } from "react-router-dom";
import HelpPageLayout from "../pages/user/help/HelpPageLayout";
import HelpFaq from "../pages/user/help/faq/HelpFaq";
import HelpGuides from "../pages/user/help/guides/HelpGuides";
import HelpGlossary from "../pages/user/help/glossary/HelpGlossary";
import HelpContact from "../pages/user/help/contact/HelpContact";

// No AccessRoute anywhere in this tree -- Help stays fully universal (R2 in
// route_access_matrix.csv), visible to every authenticated user.
export default (
  <Route path="help" element={<HelpPageLayout />}>
    <Route index element={<Navigate to="faq" replace />} />
    <Route path="faq" element={<HelpFaq />} />
    <Route path="guides" element={<HelpGuides />} />
    <Route path="glossary" element={<HelpGlossary />} />
    <Route path="contact" element={<HelpContact />} />
  </Route>
);
