import geopandas as gpd
from shapely.geometry import shape

def evaluate_predictions(predictions_geojson: dict, ground_truth_geojson: dict, iou_threshold: float = 0.5):
    """
    Real GT evaluation logic using IoU and feature matching.
    """
    if not predictions_geojson.get("features"):
        return {"available": False, "reason": "No prediction features to evaluate."}
    if not ground_truth_geojson.get("features"):
        return {"available": False, "reason": "No ground truth features to evaluate."}

    try:
        preds_gdf = gpd.GeoDataFrame.from_features(predictions_geojson["features"])
        gt_gdf = gpd.GeoDataFrame.from_features(ground_truth_geojson["features"])
    except Exception as e:
        return {"available": False, "reason": f"Invalid feature data: {str(e)}"}

    pred_crs = predictions_geojson.get("crs")
    gt_crs = ground_truth_geojson.get("crs")
    
    if pred_crs and not gt_crs:
        return {"available": False, "reason": "GT_CRS_UNAVAILABLE"}
    if gt_crs and not pred_crs:
        return {"available": False, "reason": "PREDICTION_CRS_UNAVAILABLE"}

    if pred_crs and gt_crs:
        preds_gdf.set_crs(pred_crs, inplace=True, allow_override=True)
        gt_gdf.set_crs(gt_crs, inplace=True, allow_override=True)
        
        if preds_gdf.crs != gt_gdf.crs:
            try:
                preds_gdf = preds_gdf.to_crs(gt_gdf.crs)
            except Exception as e:
                return {"available": False, "reason": f"CRS transformation failed: {str(e)}"}

    matched_preds = set()
    matched_gts = set()
    
    for p_idx, p_row in preds_gdf.iterrows():
        p_geom = p_row.geometry
        if not p_geom or not p_geom.is_valid or p_geom.is_empty:
            continue
            
        best_iou = 0
        best_gt_idx = -1
        
        intersecting = gt_gdf[gt_gdf.intersects(p_geom)]
        
        for g_idx, g_row in intersecting.iterrows():
            if g_idx in matched_gts:
                continue
            g_geom = g_row.geometry
            if not g_geom or not g_geom.is_valid or g_geom.is_empty:
                continue
                
            intersection_area = p_geom.intersection(g_geom).area
            union_area = p_geom.union(g_geom).area
            if union_area > 0:
                iou = intersection_area / union_area
                if iou > best_iou:
                    best_iou = iou
                    best_gt_idx = g_idx
                    
        if best_iou >= iou_threshold:
            matched_preds.add(p_idx)
            matched_gts.add(best_gt_idx)

    tp = len(matched_preds)
    fp = len(preds_gdf) - tp
    fn = len(gt_gdf) - len(matched_gts)
    
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    return {
        "available": True,
        "ground_truth": {"features": len(gt_gdf)},
        "predictions": {"features": len(preds_gdf)},
        "matching": {"iou_threshold": iou_threshold, "matched": tp},
        "metrics": {
            "iou": best_iou if tp > 0 else 0.0,
            "precision": precision,
            "recall": recall,
            "f1": f1
        }
    }
