import { TestBed } from '@angular/core/testing';

import { Bitcoin } from './bitcoin';

describe('Bitcoin', () => {
  let service: Bitcoin;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Bitcoin);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
