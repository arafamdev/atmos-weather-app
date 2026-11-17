import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

// Keep weather data fresh for five minutes before allowing a refetch.
const QUERY_STALE_TIME = 5 * 60 * 1000;

// Create a single QueryClient instance to share the same cache
// across the entire application.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME,

      // Retry failed requests once to handle temporary network issues.
      retry: 1,

      // Prevent unnecessary requests when users return to the browser tab.
      refetchOnWindowFocus: false,
    },
  },
});

function QueryProvider({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}

      {/* Keep debugging tools out of the production application. */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

export default QueryProvider;
