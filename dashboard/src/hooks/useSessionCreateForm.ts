import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sessionApi, type Session, type CreateSessionOptions } from '../services/api';
import { useToast } from './useToast';

export interface UseSessionCreateFormArgs {
  onCreated: (session: Session) => void;
  onFailed: (message: string) => void;
}

export interface MetaConfigForm {
  phoneNumberId: string;
  accessToken: string;
  wabaId: string;
  displayPhoneNumber: string;
  businessName: string;
  verifyToken: string;
}

export interface SessionCreateForm {
  showCreateModal: boolean;
  setShowCreateModal: (open: boolean) => void;
  newSessionName: string;
  setNewSessionName: (name: string) => void;
  engineType: 'portal' | 'meta-cloud-api';
  setEngineType: (type: 'portal' | 'meta-cloud-api') => void;
  metaConfig: MetaConfigForm;
  setMetaConfig: React.Dispatch<React.SetStateAction<MetaConfigForm>>;
  creating: boolean;
  handleCreate: () => Promise<void>;
}

export function useSessionCreateForm({ onCreated, onFailed }: UseSessionCreateFormArgs): SessionCreateForm {
  const { t } = useTranslation();
  const toast = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [engineType, setEngineType] = useState<'portal' | 'meta-cloud-api'>('portal');
  const [metaConfig, setMetaConfig] = useState<MetaConfigForm>({
    phoneNumberId: '',
    accessToken: '',
    wabaId: '',
    displayPhoneNumber: '',
    businessName: '',
    verifyToken: '',
  });
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newSessionName.trim()) return;

    if (engineType === 'meta-cloud-api') {
      if (!metaConfig.phoneNumberId.trim() || !metaConfig.accessToken.trim()) {
        toast.error('Validation Error', 'Phone Number ID and Access Token are required for Meta Cloud API.');
        return;
      }
    }

    try {
      setCreating(true);
      const payload: CreateSessionOptions = {
        name: newSessionName.trim(),
        engineType,
        metaConfig:
          engineType === 'meta-cloud-api'
            ? {
                phoneNumberId: metaConfig.phoneNumberId.trim(),
                accessToken: metaConfig.accessToken.trim(),
                wabaId: metaConfig.wabaId.trim() || undefined,
                displayPhoneNumber: metaConfig.displayPhoneNumber.trim() || undefined,
                businessName: metaConfig.businessName.trim() || undefined,
                verifyToken: metaConfig.verifyToken.trim() || undefined,
              }
            : undefined,
      };

      const newSession = await sessionApi.create(payload);
      setNewSessionName('');
      setMetaConfig({
        phoneNumberId: '',
        accessToken: '',
        wabaId: '',
        displayPhoneNumber: '',
        businessName: '',
        verifyToken: '',
      });
      setShowCreateModal(false);
      toast.success(t('sessions.create.successTitle'), t('sessions.create.successDesc', { name: newSession.name }));
      onCreated(newSession);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('sessions.create.errorDefault');
      toast.error(t('sessions.create.errorTitle'), msg);
      onFailed(msg);
    } finally {
      setCreating(false);
    }
  };

  return {
    showCreateModal,
    setShowCreateModal,
    newSessionName,
    setNewSessionName,
    engineType,
    setEngineType,
    metaConfig,
    setMetaConfig,
    creating,
    handleCreate,
  };
}
