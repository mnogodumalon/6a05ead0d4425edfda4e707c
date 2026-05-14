import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import MeineGewohnheitenPage from '@/pages/MeineGewohnheitenPage';
import TaeglicherCheckInPage from '@/pages/TaeglicherCheckInPage';
import PublicFormMeineGewohnheiten from '@/pages/public/PublicForm_MeineGewohnheiten';
import PublicFormTaeglicherCheckIn from '@/pages/public/PublicForm_TaeglicherCheckIn';
// <public:imports>
// </public:imports>
// <custom:imports>
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/6a05eab89a466f5a8cf44662" element={<PublicFormMeineGewohnheiten />} />
              <Route path="public/6a05eabcff4368d63491383b" element={<PublicFormTaeglicherCheckIn />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="meine-gewohnheiten" element={<MeineGewohnheitenPage />} />
                <Route path="taeglicher-check-in" element={<TaeglicherCheckInPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
