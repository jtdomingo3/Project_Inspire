import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface DifficultyCategory {
  id: number;
  title: string;
  summary: string;
  indicators: string[];
  tips: string[];
}

@Component({
  standalone: true,
  selector: 'app-learner-difficulty-library',
  imports: [CommonModule, FormsModule],
  templateUrl: './learner-difficulty-library.component.html',
  styleUrl: './learner-difficulty-library.component.scss'
})
export class LearnerDifficultyLibraryComponent {
  readonly categories = signal<DifficultyCategory[]>([
    {
      id: 1,
      title: 'Difficulty in Displaying Interpersonal Behaviors',
      summary: 'Learners may show fearfulness, low self-esteem, withdrawal, or challenging social behavior.',
      indicators: [
        'Bullies, threatens, or deliberately annoys others',
        'Shows fearfulness, apprehension, or worry about consequences',
        'Has difficulty mingling or interacting with peers',
        'Blames self or others and shows feelings of worthlessness'
      ],
      tips: [
        'Teach explicit social routines and expected behaviors',
        'Use structured peer roles during cooperative work',
        'Provide consistent positive reinforcement for safe interactions'
      ]
    },
    {
      id: 2,
      title: 'Difficulty in Basic Learning and Applying Knowledge',
      summary: 'Includes reading, writing, counting/calculating, and spelling challenges.',
      indicators: [
        'Difficulty connecting letters and sounds or decoding words',
        'Slow, labored writing with spacing/capitalization issues',
        'Struggles with number concepts, symbols, and place value',
        'Severe spelling and grammar errors with slow output'
      ],
      tips: [
        'Use chunked instructions, visual organizers, and modeling',
        'Allow assistive tools and extra processing time',
        'Provide frequent guided practice with immediate feedback'
      ]
    },
    {
      id: 3,
      title: 'Difficulty in Communication',
      summary: 'May involve speech sound errors, articulation, phonology, fluency, or language processing.',
      indicators: [
        'Distortions, substitutions, omissions, or additions in speech',
        'Difficulty producing specific sounds clearly',
        'Stuttering or cluttering that affects participation',
        'Trouble processing verbal and nonverbal messages'
      ],
      tips: [
        'Use short, clear language and visual supports',
        'Check understanding through repeat-back strategies',
        'Coordinate with speech-language support services when needed'
      ]
    },
    {
      id: 4,
      title: 'Difficulty in Mobility',
      summary: 'Physical and motor impairments can affect movement, classroom access, and task completion.',
      indicators: [
        'Unsteady gait or difficulty with gross-motor tasks',
        'Difficulty with fine-motor tasks such as writing',
        'Fatigue or pain during movement activities',
        'Needs assistance with classroom transitions'
      ],
      tips: [
        'Ensure safe, barrier-free classroom pathways',
        'Provide adaptive seating, tools, and task alternatives',
        'Allow additional time for mobility-related transitions'
      ]
    },
    {
      id: 5,
      title: 'Difficulty in Hearing',
      summary: 'Learners may have reduced access to spoken instructions and classroom discussion.',
      indicators: [
        'Frequently asks for repetition or delayed responses',
        'Watches speaker lips/face to understand speech',
        'Limited speech or vocabulary development',
        'Poor rhythm or sentence-level communication'
      ],
      tips: [
        'Face the learner when speaking and reduce background noise',
        'Use visual cues, written directions, and gestures',
        'Check comprehension regularly during instruction'
      ]
    },
    {
      id: 6,
      title: 'Difficulty in Seeing',
      summary: 'Non-correctable vision challenges can affect pace, posture, and access to printed information.',
      indicators: [
        'Moves cautiously and relies heavily on touch',
        'Difficulty seeing standard printed materials',
        'Slower completion of visual tasks',
        'Posture adjustments due to visual strain'
      ],
      tips: [
        'Provide preferential seating and high-contrast materials',
        'Reduce glare and increase font clarity/size',
        'Allow additional time and consider assistive devices'
      ]
    },
    {
      id: 7,
      title: 'Difficulty in Remembering / Concentrating',
      summary: 'May involve short attention span, weak memory, distractibility, and incomplete task follow-through.',
      indicators: [
        'Short attention span and poor memory retention',
        'Easily distracted and struggles to finish tasks',
        'Difficulty organizing ideas and instructions',
        'Repeats unnecessary actions or reverses written work'
      ],
      tips: [
        'Use brief, sequenced instructions with visual steps',
        'Break tasks into smaller checkpoints',
        'Use repetition, routines, and structured reminders'
      ]
    },
    {
      id: 8,
      title: 'Difficulty in Performing Adaptive Skills',
      summary: 'Learners may need support in self-care, behavior regulation, and independent functioning.',
      indicators: [
        'Impulsive behavior and low frustration tolerance',
        'Limited self-care and independent living skills',
        'Social withdrawal or fear with unexpected change',
        'Possible motor awkwardness during routine activities'
      ],
      tips: [
        'Teach self-care routines explicitly and repeatedly',
        'Use predictable schedules and transition warnings',
        'Reinforce functional independence in small steps'
      ]
    },
    {
      id: 9,
      title: 'Difficulty in Seeing and Hearing (Deaf-Blindness)',
      summary: 'Combined hearing and vision loss requires major instructional adaptation and tactile learning.',
      indicators: [
        'Limited access to visual and auditory instruction',
        'Needs intensive communication support',
        'May appear passive or withdrawn in new situations',
        'Often presents with additional health or developmental needs'
      ],
      tips: [
        'Prioritize tactile and hands-on learning approaches',
        'Use individualized communication systems',
        'Coordinate multidisciplinary support planning'
      ]
    },
    {
      id: 10,
      title: 'Difficulty in Hearing with Other Disabilities',
      summary: 'Hearing impairment combined with health/attention conditions can impact classroom performance.',
      indicators: [
        'Difficulty following verbal directions consistently',
        'Reduced response to voice or environmental sound',
        'Frequent forgetfulness and organizational difficulty',
        'Inattention, restlessness, or frustration behavior'
      ],
      tips: [
        'Pair spoken directions with visual/checklist supports',
        'Monitor fatigue and health-related classroom impact',
        'Use structured routines and attention cues'
      ]
    },
    {
      id: 11,
      title: 'Difficulty in Communicating - ADHD',
      summary: 'Persistent inattention, hyperactivity, and impulsivity may disrupt learning and communication.',
      indicators: [
        'Easily distracted, forgetful, and loses materials',
        'Difficulty sustaining attention in tasks',
        'Blurts out responses and interrupts others',
        'Restlessness and frequent movement during seatwork'
      ],
      tips: [
        'Use concise instructions and timed work blocks',
        'Provide movement breaks and attention reset cues',
        'Set clear turn-taking and response routines'
      ]
    },
    {
      id: 12,
      title: 'Difficulty in Communicating - Autism',
      summary: 'Learners may show differences in social communication, flexibility, and sensory response.',
      indicators: [
        'Difficulty with social reciprocity and nonverbal cues',
        'Preference for routines and predictable structure',
        'Literal interpretation of language',
        'Possible sensory sensitivity to noise, light, or touch'
      ],
      tips: [
        'Use visual schedules and explicit social expectations',
        'Prepare learners ahead of transitions or changes',
        'Provide sensory-friendly accommodations when possible'
      ]
    },
    {
      id: 13,
      title: 'Difficulty in Communicating - Tourette Syndrome',
      summary: 'Involuntary motor and vocal tics may affect participation and peer interaction.',
      indicators: [
        'Observable repetitive motor movements',
        'Involuntary vocalizations that vary in frequency',
        'Symptoms can increase with stress or anxiety',
        'Possible impact on confidence and social participation'
      ],
      tips: [
        'Create a respectful, non-punitive classroom response',
        'Reduce stress triggers and build predictable routines',
        'Coordinate accommodations with family and specialists'
      ]
    }
  ]);

  readonly selected = signal<DifficultyCategory>(this.categories()[0]);
  readonly addModalOpen = signal(false);

  draftTitle = '';
  draftSummary = '';
  draftIndicators = '';
  draftTips = '';

  selectCategory(category: DifficultyCategory): void {
    this.selected.set(category);
  }

  openAddModal(): void {
    this.addModalOpen.set(true);
  }

  closeAddModal(): void {
    this.addModalOpen.set(false);
    this.resetDraft();
  }

  addDifficulty(): void {
    const title = this.draftTitle.trim();
    const summary = this.draftSummary.trim();
    const indicators = this.parseList(this.draftIndicators);
    const tips = this.parseList(this.draftTips);

    if (!title || !summary || indicators.length === 0 || tips.length === 0) {
      return;
    }

    const nextId = this.categories().reduce((max, item) => Math.max(max, item.id), 0) + 1;
    const nextCategory: DifficultyCategory = {
      id: nextId,
      title,
      summary,
      indicators,
      tips
    };

    this.categories.update((current) => [...current, nextCategory]);
    this.selected.set(nextCategory);
    this.closeAddModal();
  }

  private parseList(value: string): string[] {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private resetDraft(): void {
    this.draftTitle = '';
    this.draftSummary = '';
    this.draftIndicators = '';
    this.draftTips = '';
  }
}
