"""Synthetic provider-boundary diagnostics; makes no paid model API calls."""

import io
import json
from PIL import Image
from ecoloop_vision.infrastructure.images import decode_image
from ecoloop_vision.application.inspect_image import inspect_image, InspectionConfig
from ecoloop_vision.adapters.gemini import validate_gemini_response
from ecoloop_vision.tools.evaluate import evaluate_manifest

buffer = io.BytesIO()
Image.new('RGB', (100, 100), 'white').save(buffer, format='PNG')
image = decode_image(buffer.getvalue(), 'image/png')
def empty(model_id, image):
    return {'image': {'width':100,'height':100}, 'predictions': []}
def fail(*args):
    raise RuntimeError('provider authentication failed')
def detection(label, confidence=0.01):
    return {'image': {'width':100,'height':100}, 'predictions': [{'class':label,'confidence':confidence,'x':50,'y':50,'width':30,'height':30}]}
config=InspectionConfig(max_retries=0)
results={}
results['no_proposals_without_fallback']=inspect_image(image,detector_provider=empty,config=config).inventory_state
results['both_detectors_failed']=inspect_image(image,detector_provider=fail,config=config).inventory_state
results['required_full_image_fallback_failed']=inspect_image(image,detector_provider=empty,gemini_provider=fail,config=config).inventory_state
def partial(model_id,image):
    if model_id.startswith('waste-detection'): return detection('plastic_bottle')
    raise RuntimeError('B unavailable')
partial_result=inspect_image(image,detector_provider=partial,config=config)
results['one_detector_failed_low_confidence']={'inventoryState':partial_result.inventory_state,'eligibility':partial_result.objects[0].eligibility,'confidence':partial_result.objects[0].confidence,'outcomes':[o.status for o in partial_result.outcomes]}
specialist=inspect_image(image,detector_provider=lambda *args:detection('metal can',0.9),specialist_provider=lambda *args:{'class_scores':{'aluminium_can':0.99},'predicted_classes':['aluminium_can']},config=config)
results['specialist_not_applied']={'specialistResults':len(specialist.specialist_results),'resolution':specialist.objects[0].resolution,'eligibility':specialist.objects[0].eligibility}
results['prompt_label_metal_can']=validate_gemini_response({'objects':[{'label':'metal_can','count':1}]},mode='full_image').status
huge=validate_gemini_response({'objects':[{'label':'plastic_bottle','count':1000000}]},mode='full_image')
results['unbounded_fallback_count']={'status':huge.status,'count':huge.findings[0].count}
duplicate_crop=validate_gemini_response({'objects':[{'label':'plastic_bottle','count':1},{'label':'paper_bag','count':1}]},mode='crop',candidate_id='object-1')
results['multiple_objects_for_one_crop']={'status':duplicate_crop.status,'findings':len(duplicate_crop.findings)}
manifest={'purpose':'evaluation-only','datasetVersion':'audit','images':[{'imageId':'audit-image','annotationStatus':'frozen','split':'frozen-evaluation','sceneGroupId':'audit-scene','category':'clear','annotations':[{'label':'plastic_bottle','eligibility':'eligible','bbox':{'x1':0,'y1':0,'x2':0.5,'y2':0.5}}]}],'counts':{'inventoried':1,'labeled':1,'development':0,'frozenEvaluation':1,'secondReviewed':1}}
predictions={'cases':{'audit-image':[{'label':'plastic_bottle','eligibility':'eligible','bbox':{'x1':0,'y1':0,'x2':0.5,'y2':0.5}},{'label':'plastic_bottle','eligibility':'eligible','bbox':{'x1':0.6,'y1':0.6,'x2':1,'y2':1}}]}}
results['precision_with_one_correct_and_one_false_rewarded_object']=evaluate_manifest(manifest,predictions)['metrics']['rewardedClassificationPrecision']
print(json.dumps(results,indent=2))
