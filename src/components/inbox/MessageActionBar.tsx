"use client";

import { Box, IconButton, Tooltip } from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

interface MessageActionBarProps {
  isPinned?: boolean;
  isStarred?: boolean;
  text?: string;
  onPin: () => void;
  onStar: () => void;
  /** "outbound" messages appear on the right, bar floats left; inbound floats right */
  direction?: "INBOUND" | "OUTBOUND";
  disabled?: boolean;
}

export function MessageActionBar({
  isPinned,
  isStarred,
  text,
  onPin,
  onStar,
  direction = "INBOUND",
  disabled = false,
}: MessageActionBarProps) {
  const handleCopy = () => {
    if (text) {
      void navigator.clipboard.writeText(text);
    }
  };

  return (
    <Box
      className="msg-action-bar"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.25,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        boxShadow: 1,
        px: 0.5,
        py: 0.25,
      }}
    >
      <Tooltip title={isStarred ? "Unstar" : "Star"} placement="top">
        <span>
          <IconButton
            size="small"
            onClick={onStar}
            disabled={disabled}
            sx={{ color: isStarred ? "warning.main" : "text.secondary", p: 0.5 }}
          >
            {isStarred ? (
              <StarIcon sx={{ fontSize: 16 }} />
            ) : (
              <StarBorderIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title={isPinned ? "Unpin" : "Pin"} placement="top">
        <span>
          <IconButton
            size="small"
            onClick={onPin}
            disabled={disabled}
            sx={{ color: isPinned ? "primary.main" : "text.secondary", p: 0.5 }}
          >
            {isPinned ? (
              <PushPinIcon sx={{ fontSize: 16 }} />
            ) : (
              <PushPinOutlinedIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </span>
      </Tooltip>

      {text && (
        <Tooltip title="Copy text" placement="top">
          <IconButton
            size="small"
            onClick={handleCopy}
            disabled={disabled}
            sx={{ color: "text.secondary", p: 0.5 }}
          >
            <ContentCopyIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
