import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";
import "./FaqAccordion.scss";

// Multi-open accordion (each item toggles independently) -- simpler than
// single-open-closes-others, and there's no reason opening one FAQ should
// close another the user was also reading.
export default function FaqAccordion({ items }) {
  const [openIds, setOpenIds] = useState(() => new Set());

  function toggle(id) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="faqAccordion">
      {items.map((item) => {
        const isOpen = openIds.has(item.id);

        return (
          <div className="faqAccordionItem generalCard" key={item.id}>
            <button
              className="faqAccordionQuestion"
              onClick={() => toggle(item.id)}
            >
              <p className="textBold textXS">{item.title}</p>
              {isOpen ? (
                <CaretUpIcon size={18} weight="bold" />
              ) : (
                <CaretDownIcon size={18} weight="bold" />
              )}
            </button>

            <AnimatePresence mode="wait">
              {isOpen && (
                <motion.div
                  className="faqAccordionAnswer textS"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  <ReactMarkdown>{item.body}</ReactMarkdown>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
