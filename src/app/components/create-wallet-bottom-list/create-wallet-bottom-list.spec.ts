import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateWalletBottomList } from './create-wallet-bottom-list';

describe('CreateWalletBottomList', () => {
  let component: CreateWalletBottomList;
  let fixture: ComponentFixture<CreateWalletBottomList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateWalletBottomList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateWalletBottomList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
