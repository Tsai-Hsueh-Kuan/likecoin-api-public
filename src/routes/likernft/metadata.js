import { Router } from 'express';
import { ONE_DAY_IN_S } from '../../constant';
import { likeNFTCollection } from '../../util/firebase';
import { ValidationError } from '../../util/ValidationError';
import { filterLikeNFTMetadata } from '../../util/ValidationHelper';
import { getISCNPrefixDocName, getNFTOwner } from '../../util/api/likernft/mint';
import {
  getLikerNFTDynamicData,
  getDynamicNFTImage,
  getISCNDocByClassId,
} from '../../util/api/likernft/metadata';
import { getNFTISCNData, getNFTClassDataById, getISCNFromNFTClassId } from '../../util/cosmos/nft';
import { LIKER_NFT_TARGET_ADDRESS } from '../../../config/config';

const router = Router();

router.get(
  '/metadata',
  async (req, res, next) => {
    try {
      const {
        iscn_id: inputIscnId,
        class_id: inputClassId,
        // nft_id: nftId, // not used since all nft in a class use same metadata
      } = req.query;

      let classId = inputClassId;
      let classDocRef;
      if (!classId && !inputIscnId) {
        throw new ValidationError('PLEASE_DEFINE_QUERY_ID');
      }
      let iscnId = inputIscnId;
      if (iscnId) {
        if (!classId) {
          const iscnPrefix = getISCNPrefixDocName(iscnId);
          const iscnDoc = await likeNFTCollection.doc(iscnPrefix).get();
          const iscnData = iscnDoc.data();
          if (!iscnData || !iscnData.classId) {
            res.status(404).send('ISCN_NFT_NOT_FOUND');
            return;
          }
          ({ classId } = iscnData);
          classDocRef = likeNFTCollection.doc(iscnPrefix).collection('class').doc(iscnData.classId);
        } else {
          const iscnPrefix = getISCNPrefixDocName(iscnId);
          classDocRef = likeNFTCollection.doc(iscnPrefix).collection('class').doc(classId);
        }
      } else {
        ({ iscnIdPrefix: iscnId } = await getISCNFromNFTClassId(classId));
        const doc = await getISCNDocByClassId(classId);
        classDocRef = doc.ref.collection('class').doc(classId);
      }

      const classDoc = await classDocRef.get();
      const classData = classDoc.data();
      if (!classData) {
        res.status(404).send('NFT_DATA_NOT_FOUND');
        return;
      }

      const [{ owner: iscnOwner, data: iscnData }, chainData, dynamicData] = await Promise.all([
        getNFTISCNData(iscnId),
        getNFTClassDataById(classId),
        getLikerNFTDynamicData(classId, classData),
      ]);

      res.set('Cache-Control', `public, max-age=${60}, s-maxage=${60}, stale-if-error=${ONE_DAY_IN_S}`);
      res.json(filterLikeNFTMetadata({
        iscnId,
        iscnOwner,
        iscnStakeholders: iscnData.stakeholders,
        ...(classData.metadata || {}),
        ...chainData,
        ...dynamicData,
      }));
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/metadata/owners',
  async (req, res, next) => {
    try {
      const {
        iscn_id: inputIscnId,
        class_id: inputClassId,
      } = req.query;

      let classId = inputClassId;
      let iscnId = inputIscnId;
      if (!classId && !iscnId) {
        throw new ValidationError('PLEASE_DEFINE_QUERY_ID');
      }
      if (!classId) {
        const iscnPrefix = getISCNPrefixDocName(iscnId);
        const iscnDoc = await likeNFTCollection.doc(iscnPrefix).get();
        const iscnData = iscnDoc.data();
        if (!iscnData || !iscnData.classId) {
          res.status(404).send('ISCN_NFT_NOT_FOUND');
          return;
        }
        ({ classId } = iscnData);
      } else {
        ({ iscnIdPrefix: iscnId } = await getISCNFromNFTClassId(classId));
      }
      const iscnPrefix = getISCNPrefixDocName(iscnId);
      const nftQuery = await likeNFTCollection.doc(iscnPrefix)
        .collection('class').doc(classId)
        .collection('nft')
        .where('ownerWallet', '!=', LIKER_NFT_TARGET_ADDRESS)
        .get();
      const nftIds = nftQuery.docs.map(n => n.id);
      const ownerMap = {
        // don't include api holded wallet
        // LIKER_NFT_TARGET_ADDRESS: apiOwnedNFTIds,
      };
      const owners = await Promise.all(nftIds.map(id => getNFTOwner(classId, id)));
      owners.forEach((owner, index) => {
        ownerMap[owner] = ownerMap[owner] || [];
        ownerMap[owner].push(nftIds[index]);
      });
      res.set('Cache-Control', `public, max-age=${60}, s-maxage=${60}, stale-if-error=${ONE_DAY_IN_S}`);
      res.json(ownerMap);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/metadata/image/class_(:classId)(.png)?',
  async (req, res, next) => {
    try {
      const { classId } = req.params;
      const doc = await getISCNDocByClassId(classId);
      const classDocRef = await doc.ref.collection('class').doc(classId).get();
      const classData = classDocRef.data();
      // const iscnRef = queryRef.parent.parent;
      // const iscnDocRef = iscnDataRef.get();
      // const iscnData = await iscnDocRef();
      const dynamicData = await getDynamicNFTImage(classId, classData);
      res.set('Cache-Control', `public, max-age=${60}, s-maxage=${60}, stale-if-error=${ONE_DAY_IN_S}`);
      res.type('png').send(dynamicData);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
