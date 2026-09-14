import { APIRequestContext } from '@playwright/test';

interface AuthResponse {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string;
  displayName: string;
  username: string;
  isAdmin: boolean;
  pendingActivation: boolean;
}

interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  isActive: boolean;
}

interface TreeDto {
  id: string;
  name: string;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function unwrap<T>(resPromise: Promise<{ ok(): boolean; status(): number; json(): Promise<T>; url(): string }>, what: string): Promise<T> {
  const res = await resPromise;
  if (!res.ok()) {
    throw new Error(`${what} failed: ${res.status()} ${res.url()}`);
  }
  return res.json();
}

/** Logs in via the API (no UI) and returns the access token. */
export async function login(request: APIRequestContext, username: string, password: string): Promise<string> {
  const body = await unwrap<AuthResponse>(
    request.post('/api/v1/auth/login', { data: { username, password } }),
    `login as ${username}`
  );
  if (!body.accessToken) throw new Error(`login as ${username} returned no accessToken`);
  return body.accessToken;
}

/** Registers a user via the API, then activates it as an admin. Returns the new user's id. */
export async function registerAndActivate(
  request: APIRequestContext,
  adminToken: string,
  username: string,
  password: string
): Promise<string> {
  await unwrap<AuthResponse>(
    request.post('/api/v1/auth/register', { data: { username, password, displayName: username } }),
    `register ${username}`
  );

  const users = await unwrap<UserSummary[]>(
    request.get('/api/v1/admin/users', { headers: authHeaders(adminToken) }),
    'list users'
  );
  const user = users.find(u => u.username === username.toLowerCase());
  if (!user) throw new Error(`registered user ${username} not found in admin user list`);

  await unwrap(
    request.patch(`/api/v1/admin/users/${user.id}/active`, { data: { active: true }, headers: authHeaders(adminToken) }),
    `activate ${username}`
  );

  return user.id;
}

/** Creates a tree owned by the given token's user. Returns its id. */
export async function createTree(request: APIRequestContext, token: string, name: string): Promise<string> {
  const tree = await unwrap<TreeDto>(
    request.post('/api/v1/trees', { data: { name }, headers: authHeaders(token) }),
    `create tree ${name}`
  );
  return tree.id;
}

/** Creates a person in a tree. `body` is passed through as the PersonRequest payload. Returns the person's id. */
export async function createPerson(
  request: APIRequestContext,
  token: string,
  treeId: string,
  body: Record<string, unknown>
): Promise<string> {
  const person = await unwrap<{ id: string }>(
    request.post(`/api/v1/trees/${treeId}/persons`, { data: body, headers: authHeaders(token) }),
    `create person in tree ${treeId}`
  );
  return person.id;
}

export async function deleteTree(request: APIRequestContext, token: string, id: string): Promise<void> {
  await unwrap(
    request.delete(`/api/v1/trees/${id}`, { headers: authHeaders(token) }),
    `delete tree ${id}`
  );
}
