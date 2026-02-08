import { Desktop, SquaresFour, Table } from "phosphor-react";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import CardSection from "../../../../components/cardSection/CardSection";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import { useTheme } from "../../../../context/ThemeContext";
import useITAssets from "../../../../hooks/useITAssets";
import SectionHeader from "../../../../components/sectionHeader/SectionHeader";
import "./IT_Assets.scss";
import ITAssetCard from "../../../../components/itAsset/itAssetCard/ITAssetCard";
import { useState } from "react";
import Button from "../../../../components/buttons/button/Button";
import ITAssetTable from "../../../../components/itAsset/itAssetTable/ITAssetTable";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";

function IT_Assets({ setMessage }) {
  const { darkMode } = useTheme();
  const { assets, loading, error } = useITAssets({ setMessage });
  const [layout, setLayout] = useState(1); // 1: Card, 2: Table

  if (loading) return <LoadingIcon />;
  if (error) return <p className="textLight textXXS">Error loading assets</p>;
  if (!assets.length)
    return <p className="textLight textXXS">No IT assets found</p>;

  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <div className="itAssetsHeader">
              <Breadcrumbs icon={Desktop} current="IT Assets" />
              {layout === 1 ? (
                <Button
                  icon={Table}
                  tooltipName="Table View"
                  style="iconButton"
                  onClick={() => setLayout(2)}
                />
              ) : (
                <Button
                  icon={SquaresFour}
                  tooltipName="Cards View"
                  style="iconButton"
                  onClick={() => setLayout(1)}
                />
              )}
            </div>

            <CardWrapper>
              {layout === 1 ? (
                <CardLayout style="cardLayout2">
                  {assets.map((asset) => (
                    <ITAssetCard key={asset.id} asset={asset} />
                  ))}
                </CardLayout>
              ) : (
                <ITAssetTable assets={assets} />
              )}
            </CardWrapper>
          </div>
        </div>
      </section>
    </>
  );
}

export default IT_Assets;
