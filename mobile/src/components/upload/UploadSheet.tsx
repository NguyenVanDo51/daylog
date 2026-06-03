import React from 'react';
import { Modal } from 'react-native';

interface UploadSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function UploadSheet({ visible, onClose }: UploadSheetProps) {
  return <Modal visible={visible} onRequestClose={onClose} />;
}
