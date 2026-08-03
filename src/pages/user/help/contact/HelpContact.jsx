import ReactMarkdown from "react-markdown";
import { helpContactItems } from "@/data/help";

export default function HelpContact() {
  return (
    <div className="helpTabContent helpContactList">
      {helpContactItems.map((item) => (
        <div className="helpContactCard generalCard" key={item.id}>
          <p className="textBold textS">{item.title}</p>
          {item.summary && (
            <p className="textLight textXXS">{item.summary}</p>
          )}
          <p className="textBold textXXS">
            {item.contactChannel}: {item.contactTarget}
          </p>
          {item.body && (
            <div className="helpContactBody textXXS">
              <ReactMarkdown>{item.body}</ReactMarkdown>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
