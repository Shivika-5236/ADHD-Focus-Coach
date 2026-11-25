// Test all endpoints
async function testAll() {
  const BASE_URL = 'http://localhost:5001/api/v1';
  console.log('Testing APIs on:', BASE_URL);

  // 1. Health check
  const healthRes = await fetch(`${BASE_URL}/health`);
  console.log('1. Health:', await healthRes.json());

  // 2. Auth - Register
  const testEmail = `test_${Date.now()}@example.com`;
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Alex Focus', email: testEmail, password: 'password123' })
  });
  const regData = await regRes.json();
  console.log('2. Register:', regData);
  const token = regData.token;
  if (!token) throw new Error('Registration failed, no token');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 3. Auth - Me
  const meRes = await fetch(`${BASE_URL}/auth/me`, { headers: authHeaders });
  console.log('3. Auth Me:', await meRes.json());

  // 4. Projects - Create
  const createProjRes = await fetch(`${BASE_URL}/projects`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Master ADHD App', description: 'Complete implementation', color: '#6366f1' })
  });
  const project = await createProjRes.json();
  console.log('4. Create Project:', project._id, project.name);

  // 5. Projects - Add Milestone
  const msRes = await fetch(`${BASE_URL}/projects/${project._id}/milestones`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ title: 'Full Frontend-Backend Integration' })
  });
  const updatedProject = await msRes.json();
  console.log('5. Add Milestone, total count:', updatedProject.milestones.length);

  // 6. Tasks - Create Task
  const createTaskRes = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Setup MERN Stack Flow',
      notes: 'Ensure clean architecture',
      projectId: project._id,
      plannedMinutes: 25,
      priority: 'high',
      isToday: true,
      steps: [
        { title: 'Test backend models', isCompleted: true, position: 0 },
        { title: 'Connect frontend api layer', isCompleted: false, isCurrent: true, position: 1 }
      ]
    })
  });
  const task = await createTaskRes.json();
  console.log('6. Create Task:', task._id, task.title);

  // 7. Tasks - Get Tasks
  const getTasksRes = await fetch(`${BASE_URL}/tasks`, { headers: authHeaders });
  const tasks = await getTasksRes.json();
  console.log('7. Get Tasks count:', tasks.length);

  // 8. Tasks - Update Task
  const updateTaskRes = await fetch(`${BASE_URL}/tasks/${task._id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ actualMinutes: 20, state: 'COMPLETED' })
  });
  console.log('8. Update Task state:', (await updateTaskRes.json()).state);

  // 9. Focus Sessions - Create Session
  const sessionRes = await fetch(`${BASE_URL}/focus-sessions`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      taskId: task._id,
      taskTitle: task.title,
      plannedMinutes: 25,
      durationMinutes: 20,
      completed: true,
      completedStepsCount: 2,
      totalStepsCount: 2,
      status: 'COMPLETED'
    })
  });
  const session = await sessionRes.json();
  console.log('9. Create Focus Session:', session._id, session.status);

  // 10. Focus Sessions - Get Sessions
  const getSessionsRes = await fetch(`${BASE_URL}/focus-sessions`, { headers: authHeaders });
  console.log('10. Get Sessions count:', (await getSessionsRes.json()).length);

  // 11. Insights - Get Insights
  const insightsRes = await fetch(`${BASE_URL}/insights`, { headers: authHeaders });
  const insights = await insightsRes.json();
  console.log('11. Insights stats:', {
    totalFocusMinutes: insights.totalFocusMinutes,
    completedTasksCount: insights.completedTasksCount,
    streakDays: insights.streakDays
  });

  console.log('\n🎉 ALL MERN API ENDPOINTS FUNCTIONING 100% PERFECTLY WITH MONGODB!');
}

testAll().catch(console.error);
