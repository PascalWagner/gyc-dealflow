import assert from 'node:assert/strict';
import test from 'node:test';

import {
	DEAL_CARD_FOOTER_ACTIONS,
	DEAL_CARD_UTILITY_ACTIONS,
	getDealCardActionModel
} from '../src/lib/utils/dealCardUtilityAction.js';
import { getDealCardHeroConfig } from '../src/lib/utils/dealCardHero.js';

test('filter stage keeps footer explicit and compare hidden in grid mode', () => {
	const model = getDealCardActionModel({
		deal: { id: 'deal-filter' },
		pipelineStage: 'filter',
		viewMode: 'grid'
	});

	assert.equal(model.utilityAction.show, false);
	assert.equal(model.compareAction.show, false);
	assert.deepEqual(
		model.footerActions.map((action) => action.id),
		[DEAL_CARD_FOOTER_ACTIONS.NOT_INTERESTED, DEAL_CARD_FOOTER_ACTIONS.SAVE_DEAL]
	);
});

test('compare control only appears in compare mode', () => {
	const compareModel = getDealCardActionModel({
		deal: { id: 'deal-compare' },
		pipelineStage: 'review',
		viewMode: 'compare'
	});
	const mapModel = getDealCardActionModel({
		deal: { id: 'deal-map' },
		pipelineStage: 'review',
		viewMode: 'map'
	});
	const legacyMapAliasModel = getDealCardActionModel({
		deal: { id: 'deal-location' },
		pipelineStage: 'review',
		viewMode: 'location'
	});

	assert.equal(compareModel.compareAction.show, true);
	assert.equal(compareModel.compareAction.action, DEAL_CARD_UTILITY_ACTIONS.COMPARE);
	assert.equal(mapModel.compareAction.show, false);
	assert.equal(legacyMapAliasModel.compareAction.show, false);
});

test('review stage disables missing deck utility without changing footer actions', () => {
	const model = getDealCardActionModel({
		deal: { id: 'deal-review', deckUrl: '' },
		pipelineStage: 'review',
		viewMode: 'grid'
	});

	assert.equal(model.utilityAction.show, true);
	assert.equal(model.utilityAction.disabled, true);
	assert.equal(model.utilityAction.label, 'No Deck Available');
	assert.deepEqual(
		model.footerActions.map((action) => action.id),
		[DEAL_CARD_FOOTER_ACTIONS.NOT_INTERESTED, DEAL_CARD_FOOTER_ACTIONS.READY_TO_CONNECT]
	);
});

test('invested and skipped stages keep their final footer contracts', () => {
	const investedModel = getDealCardActionModel({
		deal: { id: 'deal-invested' },
		pipelineStage: 'invested',
		viewMode: 'compare'
	});
	const skippedModel = getDealCardActionModel({
		deal: { id: 'deal-skipped' },
		pipelineStage: 'skipped',
		viewMode: 'compare'
	});

	assert.equal(investedModel.allowCompare, false);
	assert.equal(investedModel.compareAction.show, false);
	assert.deepEqual(investedModel.footerActions, []);
	assert.equal(skippedModel.allowCompare, false);
	assert.deepEqual(
		skippedModel.footerActions.map((action) => action.id),
		[DEAL_CARD_FOOTER_ACTIONS.RECONSIDER]
	);
});

test('lending deals use the returns hero when history is present', () => {
	const hero = getDealCardHeroConfig({
		id: 'deal-lending-returns',
		assetClass: 'Private Credit',
		strategy: 'Lending',
		investmentName: 'Income Fund I',
		historicalReturns: [0.082, 0.091, 0.104]
	});

	assert.equal(hero.variant, 'lending-returns');
	assert.equal(hero.returnsSeries.length, 3);
	assert.equal(hero.headlineLabel, 'Target Income');
});

test('lending deals fall back cleanly to image and generic heroes when returns are missing', () => {
	const imageHero = getDealCardHeroConfig({
		id: 'deal-lending-image',
		assetClass: 'Debt',
		strategy: 'Lending',
		investmentName: 'Debt Fund II',
		imageUrl: 'https://example.com/debt-fund.jpg'
	});
	const fallbackHero = getDealCardHeroConfig({
		id: 'deal-lending-fallback',
		assetClass: 'Debt',
		strategy: 'Lending',
		investmentName: 'Debt Fund III'
	});

	assert.equal(imageHero.variant, 'standard-image');
	assert.equal(fallbackHero.variant, 'fallback');
});

test('standard deals still use the shared image hero path', () => {
	const hero = getDealCardHeroConfig({
		id: 'deal-standard-image',
		assetClass: 'Multifamily',
		dealType: 'Fund',
		investmentName: 'Sunbelt Apartments Fund',
		imageUrl: 'https://example.com/multifamily.jpg'
	});

	assert.equal(hero.variant, 'standard-image');
	assert.equal(hero.imageUrl, 'https://example.com/multifamily.jpg');
	assert.equal(hero.headlineLabel, 'Target IRR');
});
