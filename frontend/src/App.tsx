import { RouterProvider } from 'react-router-dom';

import { EventSinkProvider } from './lib/events/event-sink';
import { ErrorBoundary } from './components/ErrorBoundary';
import { router } from './router/routes';

export function App(): React.ReactElement {
  return (
    <EventSinkProvider>
      <ErrorBoundary kind="root">
        <RouterProvider router={router} />
      </ErrorBoundary>
    </EventSinkProvider>
  );
}
