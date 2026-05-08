import { RouterProvider } from 'react-router-dom';

import { EventSinkProvider } from './lib/events/event-sink';
import { router } from './router/routes';

export function App(): React.ReactElement {
  return (
    <EventSinkProvider>
      <RouterProvider router={router} />
    </EventSinkProvider>
  );
}
