import { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Upload,
  Search,
  Trash2,
  Tag,
  Loader2,
  Mail,
  Phone,
  Edit2,
  Send,
} from 'lucide-react';
import {
  contactBookApi,
  type ContactBookItem,
  type CreateContactPayload,
} from '../services/api';
import { useSessionsQuery } from '../hooks/queries';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../hooks/useToast';
import { useRole } from '../hooks/useRole';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { useNavigate } from 'react-router-dom';
import './Contacts.css';

export function Contacts() {
  useDocumentTitle('Contacts & Audiences');
  const { canWrite } = useRole();
  const toast = useToast();
  const navigate = useNavigate();

  const { data: sessions = [] } = useSessionsQuery();
  const [selectedSessionId, setSelectedSessionId] = useState('');

  const [contacts, setContacts] = useState<ContactBookItem[]>([]);
  const [tags, setTags] = useState<Array<{ tag: string; count: number }>>([]);
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactBookItem | null>(null);
  const [contactForm, setContactForm] = useState<CreateContactPayload>({
    phone: '',
    name: '',
    email: '',
    tags: [],
    notes: '',
  });
  const [tagInput, setTagInput] = useState('');

  // Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importTag, setImportTag] = useState('');
  const [importing, setImporting] = useState(false);

  // Bulk Tag Modal
  const [showBulkTagModal, setShowBulkTagModal] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState('');

  useEffect(() => {
    if (!selectedSessionId && sessions.length > 0) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [selectedSessionId, sessions]);

  const fetchContactsAndTags = async () => {
    setLoading(true);
    try {
      const [contactsRes, tagsRes] = await Promise.all([
        contactBookApi.list({
          sessionId: selectedSessionId || undefined,
          tag: selectedTag !== 'ALL' ? selectedTag : undefined,
          search: searchTerm || undefined,
          limit: 200,
        }),
        contactBookApi.getTags(selectedSessionId || undefined),
      ]);
      setContacts(contactsRes.items || []);
      setTags(tagsRes || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch contacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContactsAndTags();
  }, [selectedSessionId, selectedTag, searchTerm]);

  const handleSaveContact = async () => {
    if (!contactForm.phone.trim()) {
      toast.error('Phone number is required');
      return;
    }

    try {
      if (editingContact) {
        await contactBookApi.update(editingContact.id, {
          ...contactForm,
          sessionId: selectedSessionId || undefined,
        });
        toast.success('Contact updated');
      } else {
        await contactBookApi.create({
          ...contactForm,
          sessionId: selectedSessionId || undefined,
        });
        toast.success('Contact created');
      }
      setShowAddModal(false);
      setEditingContact(null);
      fetchContactsAndTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save contact');
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      await contactBookApi.delete(id);
      toast.success('Contact deleted');
      fetchContactsAndTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete contact');
    }
  };

  const handleImport = async () => {
    if (!importText.trim()) {
      toast.error('Please enter or upload CSV data');
      return;
    }

    setImporting(true);
    try {
      const lines = importText
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

      const parsedRows = lines.map(line => {
        const [phone, name, email, ...extraTags] = line.split(',').map(s => s.trim());
        return {
          phone,
          name: name || '',
          email: email || '',
          tags: extraTags.filter(Boolean),
        };
      });

      const res = await contactBookApi.import({
        sessionId: selectedSessionId || undefined,
        contacts: parsedRows,
        defaultTags: importTag ? [importTag.trim()] : undefined,
      });

      toast.success(`Imported: ${res.totalImported} new, ${res.totalUpdated} updated.`);
      setShowImportModal(false);
      setImportText('');
      setImportTag('');
      fetchContactsAndTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} selected contacts?`)) return;

    try {
      const res = await contactBookApi.bulkDelete(selectedIds);
      toast.success(`Deleted ${res.deletedCount} contacts`);
      setSelectedIds([]);
      fetchContactsAndTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk delete failed');
    }
  };

  const handleBulkTag = async () => {
    if (selectedIds.length === 0 || !bulkTagInput.trim()) return;

    try {
      await contactBookApi.bulkTag({
        contactIds: selectedIds,
        addTags: [bulkTagInput.trim()],
      });
      toast.success(`Tag applied to ${selectedIds.length} contacts`);
      setShowBulkTagModal(false);
      setBulkTagInput('');
      setSelectedIds([]);
      fetchContactsAndTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk tag failed');
    }
  };

  const openEditModal = (c: ContactBookItem) => {
    setEditingContact(c);
    setContactForm({
      phone: c.phone,
      name: c.name,
      email: c.email || '',
      tags: c.tags || [],
      notes: c.notes || '',
    });
    setTagInput('');
    setShowAddModal(true);
  };

  const openCreateModal = () => {
    setEditingContact(null);
    setContactForm({
      phone: '',
      name: '',
      email: '',
      tags: selectedTag !== 'ALL' ? [selectedTag] : [],
      notes: '',
    });
    setTagInput('');
    setShowAddModal(true);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === contacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(contacts.map(c => c.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(cur => (cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]));
  };

  const handleBroadcast = () => {
    navigate('/templates');
  };

  return (
    <div className="contacts-page">
      <PageHeader
        title="Contacts & Audiences"
        subtitle="Manage contact lists, tags, and audience segmentation for bulk messaging"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <select
              className="contacts-session-select"
              value={selectedSessionId}
              onChange={e => setSelectedSessionId(e.target.value)}
            >
              {sessions.length === 0 && <option value="">No Active Sessions</option>}
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.pushName?.includes('Meta') ? '(⚡ Meta)' : ''}
                </option>
              ))}
            </select>

            <button className="btn-secondary" onClick={() => setShowImportModal(true)} disabled={!canWrite}>
              <Upload size={16} />
              <span>Import CSV</span>
            </button>

            <button className="btn-primary" onClick={openCreateModal} disabled={!canWrite}>
              <Plus size={16} />
              <span>Add Contact</span>
            </button>
          </div>
        }
      />

      <div className="contacts-layout">
        {/* Audience Tags Sidebar */}
        <aside className="contacts-tags-sidebar">
          <div className="sidebar-section-header">
            <h3>AUDIENCE TAGS</h3>
            <span className="tags-count">{tags.length} tags</span>
          </div>

          <div className="tags-pill-list">
            <button
              className={`tag-pill-btn ${selectedTag === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedTag('ALL')}
            >
              <div className="tag-name">All Contacts</div>
              <span className="tag-badge">{contacts.length}</span>
            </button>

            {tags.map(t => (
              <button
                key={t.tag}
                className={`tag-pill-btn ${selectedTag === t.tag ? 'active' : ''}`}
                onClick={() => setSelectedTag(t.tag)}
              >
                <div className="tag-name">
                  <Tag size={12} />
                  <span>{t.tag}</span>
                </div>
                <span className="tag-badge">{t.count}</span>
              </button>
            ))}
          </div>

          {selectedTag !== 'ALL' && (
            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <div style={{ fontSize: '0.8rem', color: '#60a5fa', marginBottom: '6px', fontWeight: 600 }}>
                ⚡ Quick Campaign
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 8px 0' }}>
                Launch broadcast to all <strong>{contacts.length}</strong> contacts in <code>{selectedTag}</code>.
              </p>
              <button
                className="btn-primary btn-sm"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={handleBroadcast}
              >
                <Send size={13} />
                <span>Launch Broadcast</span>
              </button>
            </div>
          )}
        </aside>

        {/* Contacts Main Table */}
        <main className="contacts-main">
          <div className="contacts-toolbar">
            <div className="contacts-search-input">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search name, phone, email, or notes..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {selectedIds.length > 0 && (
              <div className="bulk-actions-bar">
                <span>{selectedIds.length} selected</span>
                <button className="btn-secondary btn-sm" onClick={() => setShowBulkTagModal(true)}>
                  <Tag size={13} />
                  <span>Add Tag</span>
                </button>
                <button className="btn-danger btn-sm" onClick={handleBulkDelete}>
                  <Trash2 size={13} />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="contacts-loading">
              <Loader2 className="animate-spin" size={32} />
            </div>
          ) : contacts.length === 0 ? (
            <div className="contacts-empty-state">
              <Users size={48} strokeWidth={1} />
              <h3>No Contacts Found</h3>
              <p>Add individual contacts or import a CSV list to start segmenting your audience.</p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <button className="btn-primary" onClick={openCreateModal}>
                  <Plus size={16} />
                  <span>Add Contact</span>
                </button>
                <button className="btn-secondary" onClick={() => setShowImportModal(true)}>
                  <Upload size={16} />
                  <span>Import CSV</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="contacts-table-container">
              <table className="contacts-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.length === contacts.length && contacts.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>Name & Phone</th>
                    <th>Email</th>
                    <th>Audience Tags</th>
                    <th>Notes</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map(contact => {
                    const isChecked = selectedIds.includes(contact.id);
                    return (
                      <tr key={contact.id} className={isChecked ? 'row-selected' : ''}>
                        <td>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectOne(contact.id)}
                          />
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                            {contact.name || 'Unnamed Contact'}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={12} />
                            <code>{contact.phone}</code>
                          </div>
                        </td>
                        <td>
                          {contact.email ? (
                            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Mail size={12} />
                              <span>{contact.email}</span>
                            </div>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>
                          <div className="table-tags-list">
                            {contact.tags && contact.tags.length > 0 ? (
                              contact.tags.map(t => (
                                <span key={t} className="contact-tag-badge">
                                  {t}
                                </span>
                              ))
                            ) : (
                              <span className="text-muted">No tags</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {contact.notes || '—'}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              className="icon-btn"
                              title="Edit Contact"
                              onClick={() => openEditModal(contact)}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              className="icon-btn danger"
                              title="Delete Contact"
                              onClick={() => handleDeleteContact(contact.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* Add / Edit Contact Modal */}
      {showAddModal && (
        <Modal
          open
          onClose={() => setShowAddModal(false)}
          title={editingContact ? 'Edit Contact' : 'Add New Contact'}
          closeLabel="Close"
          footer={
            <>
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSaveContact}>
                {editingContact ? 'Save Changes' : 'Create Contact'}
              </button>
            </>
          }
        >
          <div className="contact-modal-form">
            <div className="form-group">
              <label htmlFor="c-phone">
                Phone Number <span className="required-star">*</span>
              </label>
              <input
                id="c-phone"
                type="text"
                className="input-field"
                placeholder="+15551234567"
                value={contactForm.phone}
                onChange={e => setContactForm({ ...contactForm, phone: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="c-name">Full Name</label>
              <input
                id="c-name"
                type="text"
                className="input-field"
                placeholder="e.g. John Doe"
                value={contactForm.name}
                onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="c-email">Email Address</label>
              <input
                id="c-email"
                type="email"
                className="input-field"
                placeholder="john@example.com"
                value={contactForm.email}
                onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="c-tag">Audience Tags</label>
              <div className="tag-input-row">
                <input
                  id="c-tag"
                  type="text"
                  className="input-field"
                  placeholder="e.g. VIP, Lead (Press Enter to add)"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      e.preventDefault();
                      const val = tagInput.trim();
                      if (!contactForm.tags?.includes(val)) {
                        setContactForm({ ...contactForm, tags: [...(contactForm.tags || []), val] });
                      }
                      setTagInput('');
                    }
                  }}
                />
                <button
                  className="btn-secondary tag-add-btn"
                  type="button"
                  onClick={() => {
                    if (tagInput.trim()) {
                      const val = tagInput.trim();
                      if (!contactForm.tags?.includes(val)) {
                        setContactForm({ ...contactForm, tags: [...(contactForm.tags || []), val] });
                      }
                      setTagInput('');
                    }
                  }}
                >
                  Add Tag
                </button>
              </div>
              {contactForm.tags && contactForm.tags.length > 0 && (
                <div className="modal-tags-list">
                  {contactForm.tags.map(t => (
                    <span
                      key={t}
                      className="contact-tag-badge removable"
                      onClick={() => {
                        setContactForm({ ...contactForm, tags: contactForm.tags?.filter(x => x !== t) });
                      }}
                      title="Click to remove tag"
                    >
                      {t} ✕
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="c-notes">Notes</label>
              <textarea
                id="c-notes"
                className="textarea-field"
                rows={3}
                placeholder="Additional customer details or context..."
                value={contactForm.notes}
                onChange={e => setContactForm({ ...contactForm, notes: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <Modal
          open
          onClose={() => setShowImportModal(false)}
          title="📥 Import Contacts (CSV or Paste)"
          closeLabel="Close"
          footer={
            <>
              <button className="btn-secondary" onClick={() => setShowImportModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleImport} disabled={importing || !importText.trim()}>
                {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                <span>{importing ? 'Importing...' : 'Start Import'}</span>
              </button>
            </>
          }
        >
          <div className="contact-modal-form">
            <div className="form-group">
              <label htmlFor="imp-tag">
                Default Tag to Apply (Optional)
              </label>
              <input
                id="imp-tag"
                type="text"
                className="input-field"
                placeholder="e.g. Leads_Sept2026"
                value={importTag}
                onChange={e => setImportTag(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="imp-data">
                Paste CSV Data (One contact per line)
              </label>
              <textarea
                id="imp-data"
                className="textarea-field font-mono"
                rows={7}
                placeholder={"+15551234567, John Doe, john@example.com, VIP\n+15559876543, Sarah Connor, sarah@example.com, Lead\n+15558889999, Alex Smith"}
                value={importText}
                onChange={e => setImportText(e.target.value)}
              />
              <span className="form-helper-text">
                Format: <code>phone, name, email, tag1, tag2...</code>
              </span>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk Tag Modal */}
      {showBulkTagModal && (
        <Modal
          open
          onClose={() => setShowBulkTagModal(false)}
          title={`Tag ${selectedIds.length} Contacts`}
          closeLabel="Close"
          footer={
            <>
              <button className="btn-secondary" onClick={() => setShowBulkTagModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleBulkTag} disabled={!bulkTagInput.trim()}>
                Apply Tag
              </button>
            </>
          }
        >
          <div className="contact-modal-form">
            <div className="form-group">
              <label htmlFor="bulk-tag-name">
                Tag Name to Apply
              </label>
              <input
                id="bulk-tag-name"
                type="text"
                className="input-field"
                placeholder="e.g. VIP, BlackFriday2026"
                value={bulkTagInput}
                onChange={e => setBulkTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleBulkTag()}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
