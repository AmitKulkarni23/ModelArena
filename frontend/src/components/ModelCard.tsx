import React from "react";
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Checkbox,
  Stack,
  Box,
  Chip,
} from "@mui/material";
import TextsmsIcon from "@mui/icons-material/Textsms";
import ImageIcon from "@mui/icons-material/Image";
import { ModelSummary } from "../types/models";

interface ModelCardProps {
  model: ModelSummary;
  selected: boolean;
  onToggle: (modelId: string) => void;
}

export function ModelCard({ model, selected, onToggle }: ModelCardProps) {
  return (
    <Card
      sx={{
        cursor: "pointer",
        border: selected ? "2px solid" : "1px solid",
        borderColor: selected ? "primary.main" : "divider",
        backgroundColor: selected ? "action.selected" : "background.paper",
        transition: "all 0.2s",
      }}
      onClick={() => onToggle(model.id)}
    >
      <CardContent>
        <Stack spacing={2}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Stack spacing={0.5} sx={{ flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {model.name}
              </Typography>
              <Chip
                label={model.provider}
                size="small"
                variant="outlined"
                sx={{ width: "fit-content" }}
              />
            </Stack>
            <Checkbox
              checked={selected}
              onChange={(e) => {
                e.stopPropagation();
                onToggle(model.id);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </Box>

          <Stack spacing={1}>
            <Typography variant="caption" color="textSecondary">
              Context: {(model.context_length / 1000).toFixed(0)}k tokens
            </Typography>

            <Box sx={{ display: "flex", gap: 1 }}>
              <Chip
                icon={<TextsmsIcon />}
                label="Text"
                size="small"
                variant="outlined"
              />
              {model.modality === "multimodal" && (
                <Chip
                  icon={<ImageIcon />}
                  label="Image"
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
              <Box>
                <Typography variant="caption" color="textSecondary">
                  Prompt
                </Typography>
                <Typography variant="body2">
                  ${(model.pricing.prompt_per_million / 1000000).toFixed(6)}/1M
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="textSecondary">
                  Completion
                </Typography>
                <Typography variant="body2">
                  ${(model.pricing.completion_per_million / 1000000).toFixed(6)}/1M
                </Typography>
              </Box>
            </Box>

            {model.is_free && (
              <Chip
                label="Free"
                size="small"
                color="success"
                variant="filled"
                sx={{ width: "fit-content" }}
              />
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
