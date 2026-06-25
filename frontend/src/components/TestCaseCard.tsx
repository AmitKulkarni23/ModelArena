import React, { useState } from "react";
import {
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  Box,
  IconButton,
  Collapse,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { TestCase } from "../types/benchmark";

interface TestCaseCardProps {
  testCase: TestCase;
  index: number;
  onUpdate: (index: number, updated: TestCase) => void;
  onRemove: (index: number) => void;
}

export function TestCaseCard({
  testCase,
  index,
  onUpdate,
  onRemove,
}: TestCaseCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Test Case {index + 1}
            </Typography>
            <IconButton size="small" onClick={() => onRemove(index)} color="error">
              <DeleteIcon />
            </IconButton>
          </Box>

          <TextField
            label="Input"
            multiline
            rows={3}
            fullWidth
            value={testCase.input}
            onChange={(e) =>
              onUpdate(index, { ...testCase, input: e.target.value })
            }
            placeholder="Enter test input..."
          />

          <TextField
            label="Label"
            size="small"
            fullWidth
            value={testCase.label || ""}
            onChange={(e) =>
              onUpdate(index, { ...testCase, label: e.target.value })
            }
            placeholder="e.g., Edge case, Happy path"
          />

          <Button
            size="small"
            onClick={() => setExpanded(!expanded)}
            endIcon={<ExpandMoreIcon sx={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s" }} />}
          >
            {expanded ? "Hide" : "Show"} Expected Output
          </Button>

          <Collapse in={expanded}>
            <TextField
              label="Expected Output (Optional)"
              multiline
              rows={3}
              fullWidth
              value={testCase.expected_output || ""}
              onChange={(e) =>
                onUpdate(index, { ...testCase, expected_output: e.target.value })
              }
              placeholder="Enter expected output..."
            />
          </Collapse>
        </Stack>
      </CardContent>
    </Card>
  );
}
