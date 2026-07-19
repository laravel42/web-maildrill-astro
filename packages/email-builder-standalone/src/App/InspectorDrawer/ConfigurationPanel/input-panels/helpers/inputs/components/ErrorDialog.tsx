import { AlertTriangle } from 'lucide-react';
import React from 'react';

import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

import { ImageGenerationError } from '../types/errors';

interface ErrorDialogProps {
  error: ImageGenerationError | null;
  onClose: () => void;
}

export const ErrorDialog: React.FC<ErrorDialogProps> = ({ error, onClose }) => {
  if (!error) return null;

  return (
    <Dialog open={Boolean(error)} onClose={onClose} className="containerErrorDialog">
      <div className="errorModal">
        <DialogTitle sx={{ color: '' }} className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="w-5 h-5" />
          Image generation failed {/*{error.title}*/}
        </DialogTitle>
        <DialogContent>
          <DialogContentText className="mb-2" sx={{ color: '#7F1D1D' }}>
            Try simplifying your prompt or describing something else. If the issue persists, please try again later.{' '}
            {/*{error.message}*/}
          </DialogContentText>
          {error.action && (
            <DialogContentText className="text-sm text-gray-600">
              <strong>Suggestion</strong>: {error.action}
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} variant="contained">
            Close
          </Button>
        </DialogActions>
      </div>
    </Dialog>
  );
};
