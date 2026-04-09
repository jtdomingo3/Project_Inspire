import { Routes } from '@angular/router';

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
		path: 'lessons',
		loadComponent: () => import('./pages/lesson-workbench/lesson-workbench.component').then((component) => component.LessonWorkbenchComponent)
	},
	{
		path: 'my-lessons',
		loadComponent: () => import('./pages/my-lessons/my-lessons.component').then((component) => component.MyLessonsComponent)
	},
	{
		path: 'reflections',
		loadComponent: () => import('./pages/reflections/reflections.component').then((component) => component.ReflectionsComponent)
	},
	{
		path: 'observations',
		loadComponent: () => import('./pages/observations/observations.component').then((component) => component.ObservationsComponent)
	},
	{
		path: 'surveys',
		loadComponent: () => import('./pages/surveys/surveys.component').then((component) => component.SurveysComponent)
	},
	{
		path: 'admin',
		loadComponent: () => import('./pages/admin/admin.component').then((component) => component.AdminComponent)
	},
	{
		path: 'account-management',
		loadComponent: () => import('./pages/account-management/account-management.component').then((component) => component.AccountManagementComponent)
	},
	{
		path: 'profile',
		loadComponent: () => import('./pages/profile/profile.component').then((component) => component.ProfileComponent)
	},
	{
		path: 'references',
		loadComponent: () => import('./pages/reference-library/reference-library.component').then((component) => component.ReferenceLibraryComponent)
	},
	{
		path: 'learner-difficulty-library',
		loadComponent: () => import('./pages/learner-difficulty-library/learner-difficulty-library.component').then((component) => component.LearnerDifficultyLibraryComponent)
	},
	{
		path: '**',
		redirectTo: 'dashboard'
	}
];
