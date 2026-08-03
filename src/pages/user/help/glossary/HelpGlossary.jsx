import ReactMarkdown from "react-markdown";
import { helpGlossaryItems } from "@/data/help";

// Terms are short enough (one-line definitions) that expand/collapse would
// be pure overhead -- a plain definition list, no accordion needed.
export default function HelpGlossary() {
  return (
    <div className="helpTabContent helpGlossaryList">
      {helpGlossaryItems.map((item) => (
        <div className="helpGlossaryTerm generalCard" key={item.id}>
          <p className="textBold textXS">{item.title}</p>
          <div className="textLight textXXS">
            <ReactMarkdown>{item.body}</ReactMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
}
