import { Route, Routes } from 'react-router-dom';
import { PublicLayout } from './layouts/PublicLayout';
import { AppLayout } from './layouts/AppLayout';
import { AdminLayout } from './layouts/AdminLayout';
import {
  RedirectIfAuthenticated,
  RequireAdmin,
  RequireAuth,
} from './components/layout/RouteGuards';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { GoalsPage } from './pages/GoalsPage';
import { NewGoalPage } from './pages/NewGoalPage';
import { GoalDetailPage } from './pages/GoalDetailPage';
import { CollectionPage } from './pages/CollectionPage';
import { CollectibleDetailPage } from './pages/CollectibleDetailPage';
import { TradesPage } from './pages/TradesPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { AdminArtworksPage } from './pages/admin/AdminArtworksPage';
import { AdminRewardRulesPage } from './pages/admin/AdminRewardRulesPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { NotFoundPage } from './pages/NotFoundPage';

/** Portuguese route names throughout, matching the product's language. */
export function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route element={<RedirectIfAuthenticated />}>
          <Route path="entrar" element={<LoginPage />} />
          <Route path="cadastro" element={<RegisterPage />} />
        </Route>
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="metas" element={<GoalsPage />} />
          <Route path="metas/nova" element={<NewGoalPage />} />
          <Route path="metas/:id" element={<GoalDetailPage />} />
          <Route path="colecao" element={<CollectionPage />} />
          <Route path="colecao/:id" element={<CollectibleDetailPage />} />
          <Route path="trocas" element={<TradesPage />} />
          <Route path="perfil" element={<ProfilePage />} />

          <Route element={<RequireAdmin />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<AdminOverviewPage />} />
              <Route path="artes" element={<AdminArtworksPage />} />
              <Route path="regras" element={<AdminRewardRulesPage />} />
              <Route path="usuarios" element={<AdminUsersPage />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
