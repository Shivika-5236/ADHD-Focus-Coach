import React, { useState } from 'react';
import { Map, Plus, Sparkles, ChevronRight, FolderPlus, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTaskContext } from '../context/TaskContext';
import { api } from '../services/api';

interface ProjectMapProps {
  onOpenTaskDetail: (taskId: string) => void;
}

export const ProjectMap: React.FC<ProjectMapProps> = ({ onOpenTaskDetail }) => {
  const {
    projects,
    tasks,
    createProject,
    addMilestoneToProject,
    setNextActionableMilestone,
    addTasksToMilestone,
    applyProjectMilestones,
  } = useTaskContext();

  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');

  // AI Decomposition states
  const [decomposingMilestoneId, setDecomposingMilestoneId] = useState<string | null>(null);
  const [milestoneErrors, setMilestoneErrors] = useState<Record<string, string>>({});
  const [milestoneFeedback, setMilestoneFeedback] = useState<Record<string, string>>({});

  const [isDecomposingProject, setIsDecomposingProject] = useState(false);
  const [projectAiError, setProjectAiError] = useState<string | null>(null);
  const [projectAiFeedback, setProjectAiFeedback] = useState<string | null>(null);

  const activeProject = projects.find(p => p.id === selectedProjectId) || projects[0];

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const created = await createProject(newProjectName.trim(), newProjectDesc.trim());
    setSelectedProjectId(created.id);
    setNewProjectName('');
    setNewProjectDesc('');
    setShowCreateModal(false);
    setProjectAiError(null);
    setProjectAiFeedback(null);
  };

  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneTitle.trim() || !activeProject) return;
    addMilestoneToProject(activeProject.id, newMilestoneTitle.trim());
    setNewMilestoneTitle('');
  };

  const handleDecomposeMilestone = async (milestoneId: string) => {
    if (!activeProject || decomposingMilestoneId) return;
    const milestone = activeProject.milestones.find(m => m.id === milestoneId);
    if (!milestone) return;

    const existingTaskTitles = tasks
      .filter(t => milestone.taskIds.includes(t.id))
      .map(t => t.title);

    setDecomposingMilestoneId(milestoneId);
    setMilestoneErrors(prev => {
      const next = { ...prev };
      delete next[milestoneId];
      return next;
    });
    setMilestoneFeedback(prev => {
      const next = { ...prev };
      delete next[milestoneId];
      return next;
    });

    try {
      const result = await api.ai.decomposeMilestone({
        projectName: activeProject.name,
        projectDescription: activeProject.description,
        milestoneTitle: milestone.title,
        milestoneOrder: milestone.order,
        existingTaskTitles,
      });

      const created = await addTasksToMilestone(activeProject.id, milestone.id, result.tasks);
      setMilestoneFeedback(prev => ({
        ...prev,
        [milestoneId]: `Added ${created.length} focus task${created.length === 1 ? '' : 's'}`,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not break down milestone. Please retry.';
      setMilestoneErrors(prev => ({ ...prev, [milestoneId]: message }));
    } finally {
      setDecomposingMilestoneId(null);
    }
  };

  const handleDecomposeProject = async () => {
    if (!activeProject || isDecomposingProject) return;

    setIsDecomposingProject(true);
    setProjectAiError(null);
    setProjectAiFeedback(null);

    try {
      const result = await api.ai.decomposeProject({
        projectName: activeProject.name,
        projectDescription: activeProject.description,
        existingMilestones: activeProject.milestones.map(m => m.title),
      });

      const titles = result.milestones.map(m => m.title);
      await applyProjectMilestones(activeProject.id, titles);
      setProjectAiFeedback(`Mapped ${titles.length} tailored milestones`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not decompose project. Please retry.';
      setProjectAiError(message);
    } finally {
      setIsDecomposingProject(false);
    }
  };

  return (
    <div className="page-shell animate-fade-in">
      {/* Header bar */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Map size={22} color="var(--color-primary)" /> Visual Project Map
          </h1>
          <p className="page-subtitle">
            Understand structure, break milestones into concrete tasks with AI, and spotlight the single next actionable step.
          </p>
        </div>

        <button
          id="create-project-btn"
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          <FolderPlus size={16} /> New Project
        </button>
      </div>

      {projects.length === 0 ? (
        /* Clean Empty State when no static projects exist */
        <div
          id="project-empty-state"
          className="glass-panel"
          style={{ padding: '48px 24px', textAlign: 'center', borderRadius: 'var(--radius-xl)' }}
        >
          <Map size={40} color="var(--color-primary)" style={{ marginBottom: '14px', opacity: 0.8 }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No Projects Mapped Yet</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 20px', lineHeight: 1.5 }}>
            Create a project to visually map milestones, track sequential work, and automatically spotlight the single next actionable step.
          </p>
          <button
            id="empty-create-project-btn"
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <FolderPlus size={16} /> Create Your First Project
          </button>
        </div>
      ) : (
        <>
          {/* Project Selector Tabs */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {projects.map(project => (
              <button
                key={project.id}
                id={`project-tab-${project.id}`}
                className="btn btn-secondary"
                onClick={() => {
                  setSelectedProjectId(project.id);
                  setProjectAiError(null);
                  setProjectAiFeedback(null);
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  background: project.id === activeProject?.id ? 'var(--bg-surface)' : 'transparent',
                  borderColor: project.id === activeProject?.id ? 'var(--color-primary)' : 'var(--border-subtle)',
                  color: project.id === activeProject?.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)' }} />
                {project.name}
              </button>
            ))}
          </div>

          {activeProject && (
            <div className="glass-panel" style={{ padding: '28px', position: 'relative' }}>
              {/* Project Details + AI Project Decomposition Action */}
              <div
                style={{
                  marginBottom: '24px',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '18px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: '1 1 260px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 600 }}>{activeProject.name}</h3>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: 'var(--primary-subtle)',
                        color: 'var(--primary-text)',
                        border: '1px solid var(--primary-border)',
                        padding: '2px 9px',
                        borderRadius: '999px',
                      }}
                    >
                      {activeProject.milestones.length} Milestone{activeProject.milestones.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                    {activeProject.description || 'No description yet.'}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <button
                    id="ai-decompose-project-btn"
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleDecomposeProject}
                    disabled={isDecomposingProject}
                    style={{
                      padding: '8px 14px',
                      fontSize: '0.82rem',
                      borderRadius: 'var(--radius-sm)',
                      opacity: isDecomposingProject ? 0.75 : 1,
                      cursor: isDecomposingProject ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isDecomposingProject ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Planning milestones...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        AI Plan Milestones
                      </>
                    )}
                  </button>

                  {projectAiFeedback && (
                    <span
                      style={{
                        fontSize: '0.74rem',
                        color: 'var(--success-text)',
                        fontWeight: 500,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <CheckCircle2 size={12} color="var(--color-success)" />
                      {projectAiFeedback}
                    </span>
                  )}
                </div>
              </div>

              {projectAiError && (
                <div
                  role="alert"
                  style={{
                    marginBottom: '16px',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--alert-subtle)',
                    border: '1px solid var(--color-alert)',
                    color: 'var(--alert-text)',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    {projectAiError}
                  </span>
                  <button
                    type="button"
                    onClick={handleDecomposeProject}
                    style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--alert-text)', textDecoration: 'underline' }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Visual Milestone Graph / Journey */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Sequential Work Breakdown & Next Actionable Node
                </div>

                <div
                  id="project-visual-graph"
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    gap: '12px',
                    overflowX: 'auto',
                    padding: '16px 4px 20px',
                  }}
                >
                  {activeProject.milestones.map((milestone, idx) => {
                    const milestoneTasks = tasks.filter(t => milestone.taskIds.includes(t.id));
                    const isNext = Boolean(milestone.isNextActionable);
                    const isDecomposingThis = decomposingMilestoneId === milestone.id;
                    const milestoneError = milestoneErrors[milestone.id];
                    const feedbackMsg = milestoneFeedback[milestone.id];

                    return (
                      <React.Fragment key={milestone.id}>
                        {/* Milestone Card */}
                        <div
                          id={`milestone-node-${milestone.id}`}
                          className="glass-panel"
                          style={{
                            minWidth: '250px',
                            maxWidth: '295px',
                            flex: 1,
                            padding: '18px',
                            borderRadius: 'var(--radius-lg)',
                            background: 'var(--bg-surface-elevated)',
                            border: isNext ? '2px solid var(--color-accent)' : '1px solid var(--border-subtle)',
                            boxShadow: isNext ? 'var(--shadow-card)' : 'none',
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                          }}
                        >
                          {/* Next Actionable Badge (US-004) */}
                          {isNext && (
                            <div
                              id={`next-actionable-badge-${milestone.id}`}
                              style={{
                                position: 'absolute',
                                top: '-12px',
                                left: '16px',
                                background: 'var(--color-accent)',
                                color: '#1B2A4A',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                padding: '3px 10px',
                                borderRadius: '999px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: 'var(--shadow-subtle)',
                              }}
                            >
                              <Sparkles size={11} /> NEXT ACTIONABLE PART
                            </div>
                          )}

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                STAGE {milestone.order}
                              </span>
                              {!isNext && (
                                <button
                                  id={`set-next-actionable-btn-${milestone.id}`}
                                  type="button"
                                  className="btn btn-ghost"
                                  onClick={() => setNextActionableMilestone(activeProject.id, milestone.id)}
                                  title="Mark as next actionable milestone"
                                  style={{ fontSize: '0.7rem', padding: '2px 6px', color: 'var(--text-muted)' }}
                                >
                                  Set as Next
                                </button>
                              )}
                            </div>

                            <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px' }}>
                              {milestone.title}
                            </h4>

                            {/* AI Milestone Breakdown Button */}
                            <button
                              id={`ai-decompose-milestone-btn-${milestone.id}`}
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => handleDecomposeMilestone(milestone.id)}
                              disabled={Boolean(decomposingMilestoneId)}
                              style={{
                                width: '100%',
                                padding: '6px 10px',
                                marginBottom: '10px',
                                fontSize: '0.77rem',
                                borderRadius: 'var(--radius-sm)',
                                opacity: decomposingMilestoneId && !isDecomposingThis ? 0.55 : 1,
                                cursor: decomposingMilestoneId ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {isDecomposingThis ? (
                                <>
                                  <Loader2 size={13} className="animate-spin" />
                                  Breaking down...
                                </>
                              ) : (
                                <>
                                  <Sparkles size={13} />
                                  {milestoneTasks.length > 0 ? 'AI Add More Tasks' : 'AI Breakdown'}
                                </>
                              )}
                            </button>

                            {milestoneError && (
                              <div
                                role="alert"
                                style={{
                                  marginBottom: '10px',
                                  padding: '6px 8px',
                                  borderRadius: 'var(--radius-sm)',
                                  background: 'var(--alert-subtle)',
                                  border: '1px solid var(--color-alert)',
                                  color: 'var(--alert-text)',
                                  fontSize: '0.73rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '6px',
                                }}
                              >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <AlertCircle size={12} style={{ flexShrink: 0 }} />
                                  {milestoneError}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDecomposeMilestone(milestone.id)}
                                  style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--alert-text)', textDecoration: 'underline', flexShrink: 0 }}
                                >
                                  Retry
                                </button>
                              </div>
                            )}

                            {feedbackMsg && !milestoneError && (
                              <div
                                style={{
                                  marginBottom: '10px',
                                  fontSize: '0.73rem',
                                  color: 'var(--success-text)',
                                  fontWeight: 500,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <CheckCircle2 size={12} color="var(--color-success)" />
                                {feedbackMsg}
                              </div>
                            )}

                            {/* Associated Tasks */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                              {milestoneTasks.length === 0 ? (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  No tasks assigned yet. Click <strong>AI Breakdown</strong> to generate starter tasks.
                                </div>
                              ) : (
                                milestoneTasks.map(t => (
                                  <div
                                    key={t.id}
                                    id={`project-task-${t.id}`}
                                    onClick={() => onOpenTaskDetail(t.id)}
                                    style={{
                                      background: 'var(--bg-surface)',
                                      padding: '8px 10px',
                                      borderRadius: 'var(--radius-sm)',
                                      fontSize: '0.8rem',
                                      cursor: 'pointer',
                                      border: '1px solid var(--border-subtle)',
                                    }}
                                  >
                                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{t.title}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                                      <span>
                                        {t.state}
                                        {t.steps.length > 0 ? ` · ${t.steps.length} steps` : ''}
                                      </span>
                                      <span>{t.plannedMinutes}m</span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                            {milestoneTasks.length} task{milestoneTasks.length === 1 ? '' : 's'} linked
                          </div>
                        </div>

                        {/* Visual Connector / Relationship Arrow */}
                        {idx < activeProject.milestones.length - 1 && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--text-muted)',
                              padding: '0 4px',
                            }}
                          >
                            <ChevronRight size={24} color="var(--color-primary)" />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Add Milestone Form */}
              <form
                onSubmit={handleAddMilestone}
                style={{
                  marginTop: '20px',
                  padding: '14px',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center',
                }}
              >
                <input
                  id="new-milestone-title-input"
                  className="input-text"
                  type="text"
                  placeholder="Add next project milestone / major piece of work..."
                  value={newMilestoneTitle}
                  onChange={e => setNewMilestoneTitle(e.target.value)}
                  style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                />
                <button
                  id="add-milestone-btn"
                  type="submit"
                  className="btn btn-secondary"
                  disabled={!newMilestoneTitle.trim()}
                  style={{ fontSize: '0.85rem', padding: '8px 14px', whiteSpace: 'nowrap' }}
                >
                  <Plus size={16} /> Add Milestone
                </button>
              </form>
            </div>
          )}
        </>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '14px' }}>Create New Project</h3>
            <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Project Name (Required)
                </label>
                <input
                  id="create-project-name-input"
                  className="input-text"
                  type="text"
                  placeholder="e.g. Master's Thesis Research"
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Description / High-Level Goal
                </label>
                <textarea
                  id="create-project-desc-input"
                  className="input-text"
                  rows={3}
                  placeholder="Briefly define the scope..."
                  value={newProjectDesc}
                  onChange={e => setNewProjectDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  id="submit-create-project-btn"
                  type="submit"
                  className="btn btn-primary"
                  disabled={!newProjectName.trim()}
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
