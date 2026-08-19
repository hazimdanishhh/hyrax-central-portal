import ReactMarkdown from "react-markdown";
import "./GuideStepList.scss";

// Generic, department-agnostic renderer for a step-by-step guide -- every
// department's guide topic page reuses this as-is, only `steps` changes.
// media.type "video" tries an embeddable form first (YouTube/Vimeo/Drive
// share links, same Drive-link convention already used for quotation/PO
// documents elsewhere in Sales); anything else falls back to a native
// <video> tag with a plain link, since there's no video upload path
// anywhere in this app -- every video is an external link a guide author
// pasted in.
function getVideoEmbedUrl(url) {
  const youtubeMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/,
  );
  if (youtubeMatch) return `https://www.youtube.com/embed/${youtubeMatch[1]}`;

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;

  return null;
}

function GuideMedia({ item }) {
  if (item.type === "image") {
    return (
      <figure className="guideMediaItem">
        <img src={item.url} alt={item.caption || ""} />
        {item.caption && (
          <figcaption className="textLight textXXS">
            {item.caption}
          </figcaption>
        )}
      </figure>
    );
  }

  const embedUrl = getVideoEmbedUrl(item.url);

  return (
    <figure className="guideMediaItem">
      {embedUrl ? (
        <iframe
          src={embedUrl}
          title={item.caption || "Guide video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video src={item.url} controls>
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            Watch video
          </a>
        </video>
      )}
      {item.caption && (
        <figcaption className="textLight textXXS">{item.caption}</figcaption>
      )}
    </figure>
  );
}

export default function GuideStepList({ steps }) {
  return (
    <div className="guideStepList">
      {steps.map((step, index) => (
        <div className="guideStep generalCard cardPaddingMedium" key={index}>
          <div className="guideStepHeader">
            <div className="guideStepNumber">{index + 1}</div>
            <p className="textBold textS">{step.title}</p>
          </div>

          <div className="guideStepBody textRegular textXS">
            <ReactMarkdown>{step.body}</ReactMarkdown>
          </div>

          {step.media?.length > 0 && (
            <div className="guideStepMedia">
              {step.media.map((item, mediaIndex) => (
                <GuideMedia item={item} key={mediaIndex} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
