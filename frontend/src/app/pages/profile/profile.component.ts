import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';

interface StoredAuth {
  role?: string;
  name?: string;
  roleLabel?: string;
  username?: string;
}

@Component({
  standalone: true,
  selector: 'app-profile',
  imports: [CommonModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent {
  readonly auth = signal<StoredAuth>(this.readAuth());

  private readAuth(): StoredAuth {
    const raw = window.localStorage.getItem('inspire-demo-auth');
    if (!raw) {
      return {
        name: 'Not signed in',
        username: '-',
        roleLabel: 'Guest',
        role: 'guest'
      };
    }

    try {
      const parsed = JSON.parse(raw) as StoredAuth;
      return {
        name: parsed.name || 'Unknown User',
        username: parsed.username || '-',
        roleLabel: parsed.roleLabel || 'Teacher',
        role: parsed.role || 'teacher'
      };
    } catch {
      return {
        name: 'Not signed in',
        username: '-',
        roleLabel: 'Guest',
        role: 'guest'
      };
    }
  }
}
