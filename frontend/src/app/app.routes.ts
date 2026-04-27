import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'dashboard'
	},
	{
		path: 'dashboard',
		loadComponent: () => import('./pages/dashboard/dashboard.component').then((component) => component.DashboardComponent)
	},
	{
		path: 'assistant',
		canActivate: [authGuard],
		loadComponent: () => import('./pages/inspire-assistant/inspire-assistant.component').then((component) => component.InspireAssistantComponent)
	},
	{
		path: 'lessons',
		canActivate: [authGuard],
		loadComponent: () => import('./pages/lesson-workbench/lesson-workbench.component').then((component) => component.LessonWorkbenchComponent)
	},
	{
		path: 'my-lessons',
		canActivate: [authGuard],
		loadComponent: () => import('./pages/my-lessons/my-lessons.component').then((component) => component.MyLessonsComponent)
	},
	{
		path: 'reflections',
		canActivate: [authGuard],
		loadComponent: () => import('./pages/reflections/reflections.component').then((component) => component.ReflectionsComponent)
	},
	{
		path: 'observations',
		canActivate: [authGuard],
		loadComponent: () => import('./pages/observations/observations.component').then((component) => component.ObservationsComponent)
	},
	{
		path: 'surveys',
		canActivate: [authGuard],
		loadComponent: () => import('./pages/surveys/surveys.component').then((component) => component.SurveysComponent)
	},
	{
		path: 'admin',
		canActivate: [authGuard, roleGuard],
		data: { roles: ['admin', 'researcher'] },
		loadComponent: () => import('./pages/admin/admin.component').then((component) => component.AdminComponent)
	},
	{
		path: 'account-management',
		canActivate: [authGuard, roleGuard],
		data: { roles: ['admin'] },
		loadComponent: () => import('./pages/account-management/account-management.component').then((component) => component.AccountManagementComponent)
	},
	{
		path: 'profile',
		canActivate: [authGuard],
		loadComponent: () => import('./pages/profile/profile.component').then((component) => component.ProfileComponent)
	},
	{
		path: 'settings',
		canActivate: [authGuard],
		loadComponent: () => import('./pages/settings/settings.component').then((component) => component.SettingsComponent)
	},
	{
		path: 'references',
		canActivate: [authGuard],
		loadComponent: () => import('./pages/reference-library/reference-library.component').then((component) => component.ReferenceLibraryComponent)
	},
	{
		path: 'learner-difficulty-library',
		canActivate: [authGuard],
		loadComponent: () => import('./pages/learner-difficulty-library/learner-difficulty-library.component').then((component) => component.LearnerDifficultyLibraryComponent)
	},
	{
		path: 'reminders',
		canActivate: [authGuard],
		loadComponent: () => import('./pages/reminders/reminders.component').then((component) => component.RemindersComponent)
	},
	{
		path: '**',
		redirectTo: 'dashboard'
	}
];
