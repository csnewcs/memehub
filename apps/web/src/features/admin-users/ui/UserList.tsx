import { useInfiniteQuery } from '@tanstack/react-query';
import { apiError, useApi } from '../../../shared/api/client';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../../shared/ui/table';
import { Button } from '../../../shared/ui/button';
import { listUsers } from '../api/users';

export function UserList() {
  const api = useApi();
  const query = useInfiniteQuery({
    queryKey: ['admin-users'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => listUsers(api, pageParam, signal),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
  const users = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Users</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          People who have signed in to this workspace.
        </p>
      </div>
      {query.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading users…
        </p>
      )}
      {query.isError && (
        <div role="alert" className="space-y-2 text-sm">
          <p>{apiError(query.error)}</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {users.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="py-3 pr-4 font-medium">
                  User
                </TableHead>
                <TableHead scope="col" className="py-3 pr-4 font-medium">
                  Role
                </TableHead>
                <TableHead scope="col" className="py-3 font-medium">
                  Joined
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="py-3 pr-4">
                    <p className="font-medium">
                      {user.display_name || user.username || 'Unnamed user'}
                    </p>
                    {user.username && (
                      <p className="mt-1 text-xs text-muted-foreground">@{user.username}</p>
                    )}
                  </TableCell>
                  <TableCell className="py-3 pr-4 text-xs">
                    {user.is_admin ? 'Admin' : 'Member'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap py-3 text-xs text-muted-foreground">
                    <time
                      dateTime={user.created_at}
                      title={new Date(user.created_at).toLocaleString()}
                    >
                      {new Date(user.created_at).toLocaleDateString()}
                    </time>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {query.isSuccess && users.length === 0 && (
        <p className="text-sm text-muted-foreground">No users found.</p>
      )}
      {query.hasNextPage && (
        <Button
          variant="secondary"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </section>
  );
}
