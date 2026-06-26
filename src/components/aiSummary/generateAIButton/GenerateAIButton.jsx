import React, { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import Button from "../../buttons/button/Button";
import { SparkleIcon } from "@phosphor-icons/react";
import { useMessage } from "../../../context/MessageContext";

export default function GenerateAiButton({
  type = "leads",
  filters = {},
  onComplete,
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const { showMessage } = useMessage();

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "generate-ai-summary",
        {
          body: {
            type: type,
            filters: filters, // Send the active UI filters to the edge function
          },
        },
      );

      if (invokeError) throw invokeError;

      showMessage("New AI summary generated", "success");

      if (onComplete) onComplete();
    } catch (err) {
      console.error("Failed to generate summary:", err);
      showMessage("Failed to generate summary", "error");
      setError(err.message || "Failed to trigger AI generation.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleGenerate}
        disabled={isGenerating}
        style="textBold textXS button buttonType5 aiButton"
        name={isGenerating ? "Analyzing Data..." : "Generate New AI Briefing"}
        icon2={SparkleIcon}
        weight="fill"
      />
    </>
  );
}
